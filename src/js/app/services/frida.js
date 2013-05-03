define(['app/services/service', 'app/utils'], function (Service, utils) {
    'use strict';

    var FRIDA_MIME_TYPE = 'application/x-vnd-frida';

    var Frida = Service.define({
        initialize: function initialize() {
            this.devices = null;
            this._state = 'disabled';
            this._plugin = null;
            this._handlers = [];
            this._timer = null;
            this._sessions = {};
            this._updateDevices = this._updateDevices.bind(this);
            this._onDetach = this._onDetach.bind(this);
            this._onMessage = this._onMessage.bind(this);
        },
        dispose: function dispose() {
            window.clearInterval(this._timer);
        },
        addHandler: function addHandler(handler, context) {
            context = context || handler;
            this._handlers.push(utils.bind(handler, context));
            switch (this._state) {
            case 'disabled':
                if (pluginIsInstalled()) {
                    this._loadPlugin();
                    this._state = 'enabled';
                    this._executeHandlers('enable');
                    this._updateDevices();
                } else {
                    if (handler['disable']) {
                        handler['disable'].call(context, 'missing-plugin');
                    }
                }
                if (this._timer === null) {
                    this._timer = window.setInterval(function checkPluginState() {
                        if (pluginIsInstalled()) {
                            if (this._state === 'disabled') {
                                this._loadPlugin();
                                this._state = 'enabled';
                                this._executeHandlers('enable');
                                this._updateDevices();
                            }
                        } else {
                            if (this._state === 'enabled') {
                                this.devices = null;
                                this._unloadPlugin();
                                this._state = 'disabled';
                                this._executeHandlers('disable', 'missing-plugin');
                            }
                        }
                    }.bind(this), 1000);
                }
                break;
            case 'enabled':
                if (handler['enable']) {
                    handler['enable'].call(context);
                }
                if (handler['update'] && this.devices !== null) {
                    handler['update'].call(context);
                }
                break;
            }
        },
        removeHandler: function removeHandler(handler) {
            this._handlers = this._handlers.filter(function (h) {
                return h !== handler;
            });
        },
        enumerateProcesses: function enumerateProcesses(deviceId) {
            try {
                return this._plugin.enumerateProcesses(deviceId);
            } catch (e) {
                this._onCrash(e);
                return new Deferred().reject('plugin crashed').promise();
            }
        },
        getSession: function getSession(deviceId, processId) {
            var id = sessionId(deviceId, processId);
            var session = this._sessions[id];
            if (!session) {
                session = new Session(this, this._plugin, deviceId, processId);
                this._sessions[id] = session;
            }
            return session;
        },
        _executeHandlers: function _executeHandlers(name) {
            var args = [].slice.call(arguments, 1);
            this._handlers.forEach(function executeHandler(handler) {
                if (handler[name]) {
                    handler[name].apply(handler, args);
                }
            });
        },
        _loadPlugin: function _loadPlugin() {
            this._plugin = document.createElement('embed');
            this._plugin.style.position = 'fixed';
            this._plugin.style.top = "-1px";
            this._plugin.style.left = "-1px";
            this._plugin.style.width = "1px";
            this._plugin.style.height = "1px";
            this._plugin.type = FRIDA_MIME_TYPE;
            document.body.appendChild(this._plugin);
            this._plugin.addEventListener('devices-changed', this._updateDevices);
            this._plugin.addEventListener('detach', this._onDetach);
            this._plugin.addEventListener('message', this._onMessage);
        },
        _unloadPlugin: function _unloadPlugin() {
            this._plugin.removeEventListener('message', this._onMessage);
            this._plugin.removeEventListener('detach', this._onDetach);
            this._plugin.removeEventListener('devices-changed', this._updateDevices);
            document.body.removeChild(this._plugin);
            this._plugin = null;
        },
        _updateDevices: function _updateDevices() {
            try {
                this._plugin.enumerateDevices().done(function (devices) {
                    this.devices = devices;
                    this._executeHandlers('update');
                }.bind(this));
            } catch (e) {
                this._onCrash(e);
            }
        },
        _onCrash: function _onCrash() {
            this.devices = null;
            this._unloadPlugin();
            this._state = 'disabled';
            this._executeHandlers('disable', 'plugin-crashed');
        },
        _onDetach: function _onDetach(deviceId, processId) {
            var session = this._sessions[sessionId(deviceId, processId)];
            if (session) {
                session.detach();
            }
        },
        _onMessage: function _onMessage(deviceId, processId, message, data) {
            var session = this._sessions[sessionId(deviceId, processId)];
            if (session) {
                session._onMessage(message, data);
            }
        },
        _deleteSession: function _deleteSession(session) {
            for (var id in this._sessions) {
                if (this._sessions.hasOwnProperty(id)) {
                    var s = this._sessions[id];
                    if (s === session) {
                        delete this._sessions[id];
                        return;
                    }
                }
            }
        }
    });

    var Session = function Session(service, plugin, deviceId, processId) {
        var state = 'detached',
            handlers = [];

        this.addHandler = function addHandler(handler, context) {
            handlers.push(utils.bind(handler, context));
            switch (state) {
                case 'detached':
                    this.attach();
                    break;
                case 'attaching':
                    break;
                case 'attached':
                    if (handler['attach']) {
                        handler['attach'].call(context);
                    }
                    break;
            }
        };
        this.removeHandler = function removeHandler(handler) {
            handlers = handlers.filter(function (h) {
                return h !== handler;
            });
            if (handlers.length === 0) {
                this.detach();
                service._deleteSession(this);
            }
        };
        this.attach = function attach() {
            if (state === 'detached') {
                var rawScript = Script.toString();
                var rawBody = rawScript.substring(rawScript.indexOf("{") + 1, rawScript.lastIndexOf("}"));
                var operation;
                try {
                    operation = plugin.attachTo(deviceId, processId, rawBody);
                } catch (e) {
                    service._onCrash(e);
                    return;
                }
                state = 'attaching';
                operation.done(function handleAttachSuccess() {
                    if (state === 'attaching') {
                        state = 'attached';
                        executeHandlers('attach');
                    }
                });
                operation.fail(function handleAttachFailure(reason) {
                    if (state === 'attaching') {
                        state = 'detached';
                        executeHandlers('detach', reason);
                    }
                });
            }
        };
        this.detach = function detach() {
            if (state !== 'detached') {
                try {
                    plugin.detachFrom(deviceId, processId);
                } catch (e) {
                    service._onCrash(e);
                }
                state = 'detached';
                executeHandlers('detach', null);
            }
        };
        this._onMessage = function _onMessage(message, data) {
            if (message.type === 'send') {
                executeHandlers('event', message.payload, data);
            } else {
                console.log("_onMessage", message, data);
            }
        };

        var executeHandlers = function executeHandlers(name) {
            var args = [].slice.call(arguments, 1);
            handlers.forEach(function executeHandler(handler) {
                if (handler[name]) {
                    handler[name].apply(handler, args);
                }
            });
        };
    };

    var Script = function Script() {
        /*global Interceptor:false, Memory:false, Module:false, Process:false, send:false */
        /*jshint bitwise:false*/

        var AF_INET = 2;

        var connect = null;

        if (Process.platform === 'darwin') {
            connect = Module.findExportByName('libSystem.B.dylib', 'connect$UNIX2003');
            if (!connect) {
                connect = Module.findExportByName('libSystem.B.dylib', 'connect');
            }
        }

        if (connect) {
            Interceptor.attach(connect, {
                onEnter: function(args) {
                    var fd = args[0].toInt32();
                    var sockAddr = args[1];
                    var family;
                    if (Process.platform === 'windows') {
                        family = Memory.readU8(sockAddr);
                    } else {
                        family = Memory.readU8(sockAddr.add(1));
                    }
                    if (family === AF_INET) {
                        var port = (Memory.readU8(sockAddr.add(2)) << 8) | Memory.readU8(sockAddr.add(3));
                        var ip =
                            Memory.readU8(sockAddr.add(4)) + "." +
                            Memory.readU8(sockAddr.add(5)) + "." +
                            Memory.readU8(sockAddr.add(6)) + "." +
                            Memory.readU8(sockAddr.add(7));
                        send({
                            name: 'connect',
                            type: 'event',
                            properties: {
                                fd: fd,
                                ip: ip,
                                port: port
                            }
                        });
                    }
                }
            });
        }

        if (Process.platform === 'darwin') {
            var cryptorCreate = Module.findExportByName("libcommonCrypto.dylib", "CCCryptorCreate");
            var cryptorCreateFromData = Module.findExportByName("libcommonCrypto.dylib", "CCCryptorCreateFromData");
            var cryptorRelease = Module.findExportByName("libcommonCrypto.dylib", "CCCryptorRelease");
            var cryptorUpdate = Module.findExportByName("libcommonCrypto.dylib", "CCCryptorUpdate");

            var kCCSuccess = 0;

            var ccOperation = {
                0: 'kCCEncrypt',
                1: 'kCCDecrypt'
            };
            var kCCEncrypt = 0;
            var kCCDecrypt = 1;

            var ccAlgorithm = {
                0: 'kCCAlgorithmAES128',
                1: 'kCCAlgorithmDES',
                2: 'kCCAlgorithm3DES',
                3: 'kCCAlgorithmCAST',
                4: 'kCCAlgorithmRC4',
                5: 'kCCAlgorithmRC2'
            };

            if (cryptorCreate && cryptorCreateFromData && cryptorRelease && cryptorUpdate) {

                var cryptors = {};
                var lastCryptorId = 1;

                var createCryptor = function createCryptor(op, alg) {
                    return {
                        id: lastCryptorId++,
                        op: op,
                        alg: alg,
                        properties: {
                            handle: null,
                            op: ccOperation[op] || 'kCCInvalid',
                            alg: ccAlgorithm[alg] || 'kCCAlgorithmInvalid',
                        }
                    };
                };

                var registerCryptor = function registerCryptor(cryptor, handle) {
                    cryptor.properties.handle = "0x" + handle.toString(16);
                    cryptors[handle.toString()] = cryptor;
                };

                Interceptor.attach(cryptorCreate, {
                    onEnter: function (args) {
                        this.cryptor = createCryptor(args[0].toInt32(), args[1].toInt32());
                        this.cryptorRef = args[6];
                    },
                    onLeave: function (retval) {
                        if (retval.toInt32() === kCCSuccess) {
                            var handle = Memory.readPointer(this.cryptorRef);
                            registerCryptor(this.cryptor, handle);
                            send({
                                name: 'CCCryptorCreate',
                                type: 'event',
                                properties: this.cryptor.properties
                            });
                        }
                    }
                });
                Interceptor.attach(cryptorCreateFromData, {
                    onEnter: function (args) {
                        if (this.depth === 0) {
                            this.cryptor = createCryptor(args[0].toInt32(), args[1].toInt32());
                            this.cryptorRef = args[8];
                        }
                    },
                    onLeave: function (retval) {
                        if (this.depth === 0 && retval.toInt32() === kCCSuccess) {
                            var handle = Memory.readPointer(this.cryptorRef);
                            registerCryptor(this.cryptor, handle);
                            send({
                                name: 'CCCryptorCreateFromData',
                                type: 'event',
                                properties: this.cryptor.properties
                            });
                        }
                    }
                });

                Interceptor.attach(cryptorRelease, {
                    onEnter: function (args) {
                        send({
                            name: 'CCCryptorRelease',
                            type: 'event',
                            properties: {
                                handle: "0x" + args[0].toString(16)
                            }
                        });
                        delete cryptors[args[0].toString()];
                    }
                });

                Interceptor.attach(cryptorUpdate, {
                    onEnter: function (args) {
                        this.cryptor = cryptors[args[0].toString()];
                        if (this.cryptor) {
                            if (this.cryptor.op === kCCEncrypt) {
                                this.data = Memory.readByteArray(args[1], args[2].toInt32());
                            } else {
                                this.dataOut = args[3];
                                this.dataOutMoved = args[5];
                            }
                        } else {
                            send({
                                name: 'CCCryptorUpdate',
                                type: 'warning',
                                properties: {
                                    message: "unknown cryptor handle: 0x" + args[0].toString(16)
                                }
                            });
                        }
                    },
                    onLeave: function (retval) {
                        if (retval.toInt32() === kCCSuccess && this.cryptor) {
                            var cryptor = this.cryptor,
                                data;
                            if (cryptor.op === kCCEncrypt) {
                                data = this.data;
                            } else {
                                data = Memory.readByteArray(this.dataOut, Memory.readPointer(this.dataOutMoved).toInt32());
                            }
                            send({
                                name: 'CCCryptorUpdate',
                                type: (cryptor.op === kCCDecrypt) ? 'incoming' : 'outgoing',
                                properties: cryptor.properties,
                                dataLength: data.length
                            }, data);
                        }
                    }
                });
            }
        }
    };

    var pluginIsInstalled = function pluginIsInstalled() {
        var mimeTypes = window.navigator.mimeTypes;
        for (var i = 0; i !== mimeTypes.length; i++) {
            if (mimeTypes[i].type === FRIDA_MIME_TYPE) {
                return true;
            }
        }
        return false;
    };

    var sessionId = function sessionId(deviceId, processId) {
        return deviceId + "|" + processId;
    };

    return Frida;
});
