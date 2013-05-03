define(['app/services/service', 'app/utils', 'deferred', 'lru'], function (Service, utils, Deferred, LRUCache) {
    'use strict';

    var OSpy = Service.define({
        initialize: function initialize() {
            this._projects = {};
        },
        dispose: function dispose() {
            for (var id in this._projects) {
                if (this._projects.hasOwnProperty(id)) {
                    this._projects[id].dispose();
                }
            }
        },
        get: function get(id) {
            var project = this._projects[id];
            if (!project) {
                project = new Project(this, id);
                this._projects[id] = project;
            }
            return project;
        },
        _delete: function _delete(id) {
            var project = this._projects[id];
            project.dispose();
            delete this._projects[id];
        }
    });

    var Project = function Project(service, id) {
        var state = 'not-joined',
            socket = null,
            requests = {},
            lastRequestId = 0,
            stream = new Stream(this),
            handlers = [];

        this.dispose = function dispose() {
        };

        this.addHandler = function addHandler(handler, context) {
            context = context || handler;
            handlers.push(utils.bind(handler, context));
            switch (state) {
                case 'not-joined':
                    state = 'joining';
                    socket = new window.WebSocket("ws://" + service.services.settings.get('ospy.host') + "/channel/projects/" + id);
                    socket.onopen = onSocketOpen;
                    socket.onclose = onSocketClose;
                    socket.onmessage = onSocketMessage;
                    break;
                case 'joining':
                    break;
                case 'joined':
                    if (handler['join']) {
                        handler['join'].call(context);
                    }
                    break;
            }
        };
        this.removeHandler = function removeHandler(handler) {
            handlers = handlers.filter(function (h) {
                return h !== handler;
            });
            if (handlers.length === 0 && state !== 'not-joined') {
                socket.onopen = null;
                socket.onclose = null;
                socket.onmessage = null;
                socket.close();
                socket = null;
                state = 'not-joined';
                service._delete(id);
            }
        };

        this.publish = function publish() {
            return this._request({
                to: "/",
                name: '.publish',
                payload: {}
            });
        };

        Object.defineProperty(this, 'stream', {
            get: function get() { return stream; }
        });

        this._request = function _request(stanza) {
            var deferred = new Deferred();
            var id = lastRequestId++;
            stanza.id = id;
            requests[id] = deferred;
            this._send(stanza);
            return deferred;
        };

        this._send = function _send(stanza) {
            socket.send(JSON.stringify(stanza));
        };

        var onSocketOpen = function onSocketOpen() {
            executeHandlers('join');
        };
        var onSocketClose = function onSocketClose() {
            socket.onopen = null;
            socket.onclose = null;
            socket.onmessage = null;
            socket = null;
            state = 'not-joined';
            executeHandlers('leave');
        };
        var onSocketMessage = function onSocketMessage(event) {
            var stanza = JSON.parse(event.data);
            if (stanza.hasOwnProperty('id')) {
                var deferred = requests[stanza.id];
                if (stanza.name === '+result') {
                    deferred.resolve(stanza.payload);
                } else if (stanza.name === '+error') {
                    deferred.reject(stanza.payload);
                }
            } else {
                if (stanza.from === "/applications/ospy:stream") {
                    stream._handleStanza(stanza);
                } else {
                    console.log("onSocketMessage", stanza);
                }
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

    var Stream = function Stream(project) {
        var state = null,
            itemsCache = null,
            rangeCache = null,
            pending = null,
            handlers = [];

        this.addHandler = function addHandler(handler, context) {
            context = context || handler;
            handler = utils.bind(handler, context);
            if (state !== null) {
                if (handler['update']) {
                    handler['update'].call(context, state, false);
                }
            }
            handlers.push(handler);
        };
        this.removeHandler = function removeHandler(handler) {
            handlers = handlers.filter(function (h) {
                return h !== handler;
            });
        };

        this.clear = function clear() {
            send('+clear', {});
        };
        this.add = function add(items) {
            send('+add', {items: items});
        };
        this.get = function get(items) {
            var deferred = new Deferred();

            var result = [];
            var missing = [];
            for (var i = 0; i !== items.length; i++) {
                var item = itemsCache.get(items[i]._id);
                if (item) {
                    result.push(item);
                } else {
                    result.push(null);
                    missing.push(items[i]);
                }
            }

            if (missing.length === 0) {
                deferred.resolve(result);
            } else {
                var req = request('.get', {items: missing});
                req.done(function (remaining) {
                    for (var i = 0; i !== result.length; i++) {
                        if (result[i] === null) {
                            var item = remaining.shift();
                            itemsCache.put(item._id, item);
                            result[i] = item;
                        }
                    }
                    deferred.resolve(result);
                });
                req.fail(function (error) {
                    deferred.reject(error);
                });
            }

            return deferred.promise();
        };
        this.getAt = function getAt(indexes) {
            var deferred = new Deferred();

            var result = [];
            var missing = [];
            for (var i = 0; i !== indexes.length; i++) {
                var item = rangeCache.get(indexes[i]);
                if (item) {
                    result.push(item);
                } else {
                    result.push(null);
                    missing.push(indexes[i]);
                }
            }

            if (missing.length === 0) {
                deferred.resolve(result);
            } else {
                var req = request('.get-at', {indexes: missing});
                req.done(function (remaining) {
                    for (var i = 0; i !== result.length; i++) {
                        if (result[i] === null) {
                            var item = remaining.shift();
                            rangeCache.put(indexes[i], item);
                            result[i] = item;
                        }
                    }
                    deferred.resolve(result);
                });
                req.fail(function (error) {
                    deferred.reject(error);
                });
            }

            return deferred.promise();
        };
        this.getRange = function getRange(startIndex, limit) {
            var deferred = new Deferred();

            this.getCachedRange(startIndex, limit, function (error, result) {
                if (error) {
                    deferred.reject(error);
                } else {
                    deferred.resolve(result.items);
                }
            });

            return deferred.promise();
        };
        this.getCachedRange = function getCachedRange(startIndex, limit, callback) {
            var result = [],
                i,
                item;

            for (i = startIndex; i !== startIndex + limit; i++) {
                item = rangeCache.get(i);
                if (item) {
                    result.push(item);
                } else {
                    break;
                }
            }
            startIndex += result.length;
            limit -= result.length;

            if (startIndex < state.total && limit > 0) {
                _getRange(startIndex, Math.max(limit, 20)).done(function (remainder) {
                    result.push.apply(result, remainder.slice(0, limit));
                    for (i = 0; i !== remainder.length; i++) {
                        item = remainder[i];
                        itemsCache.put(item._id, item);
                        rangeCache.put(startIndex + i, item);
                    }
                    if (callback) {
                        callback(null, {
                            items: result,
                            source: 'server'
                        });
                    }
                }).fail(function (error) {
                    if (callback) {
                        callback(error, null);
                    }
                });
            } else {
                if (callback) {
                    callback(null, {
                        items: result,
                        source: 'cache'
                    });
                }
            }

            return result;
        };

        Object.defineProperty(this, 'state', {
            get: function get() { return state; }
        });

        this._handleStanza = function _handleStanza(stanza) {
            switch (stanza.name) {
                case '+sync':
                    state = stanza.payload;
                    itemsCache = new LRUCache(1000);
                    rangeCache = new LRUCache(1000);
                    pending = {};
                    executeHandlers('update', state, false);
                    break;
                case '+update':
                    utils.update(state, stanza.payload);
                    executeHandlers('update', state, true);
                    break;
                default:
                    console.log("Unhandled stream stanza", stanza);
                    break;
            }
        };

        var _getRange = function _getRange(startIndex, limit) {
            var id = startIndex + ":" + limit;
            var req = pending[id];
            if (!req) {
                req = request('.get-range', {
                    'start_index': startIndex,
                    'limit': limit
                }).pipe(function (items) {
                    delete pending[id];
                    return items;
                }, function (error) {
                    delete pending[id];
                    return error;
                });
                pending[id] = req;
            }
            return req;
        };

        var request = function request(name, payload) {
            return project._request({
                to: "/applications/ospy:stream",
                name: name,
                payload: payload
            });
        };
        var send = function send(name, payload) {
            project._send({
                to: "/applications/ospy:stream",
                name: name,
                payload: payload
            });
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

    return OSpy;
});
