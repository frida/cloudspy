/*global __dirname:false, process:false*/
(function () {
    'use strict';

    var EventEmitter = require('events').EventEmitter;
    var Future = require('future');
    var WebSocketServer = require('websocket').server;
    var base62 = require('base62');
    var fs = require('fs');
    var mongo = require('mongodb');
    var path = require('path');
    var restify = require('restify');
    var url = require('url');
    var util = require('util');

    var Server = function Server(options) {
        var server,
            wsServer,
            database = null,
            collection = {},
            projects = {},
            saveTimer = null,
            saving = null;

        var initialize = function initialize() {
            server = restify.createServer();
            wsServer = new WebSocketServer({
                httpServer: server
            });
            wsServer.on('request', onWebSocketRequest);

            server.use(restify.acceptParser(server.acceptable));
            server.use(restify.gzipResponse());
            server.use(function (req, res, next) {
                var u = url.parse(req.url);
                var filepath = path.join(options.staticDir, u.pathname);
                fs.exists(filepath, function(exists) {
                    if (!exists) {
                        u.pathname = "/index.html";
                        req.url = url.format(u);
                        req._url = u;
                        req._path = u.pathname;
                    }
                    next();
                });
            });
            server.get(/.*/, restify.serveStatic({
                'directory': options.staticDir,
                'default': "index.html"
            }));
        };

        this.dispose = function dispose() {
            if (saveTimer !== null) {
                clearInterval(saveTimer);
                saveTimer = null;
            }

            wsServer.removeListener('request', onWebSocketRequest);
            wsServer.shutDown();
            server.close();

            Object.keys(projects).forEach(function (projectId) {
                projects[projectId].shutDown();
            });

            saveAll().when(function () {
                projects = {};
                collection = {};
                if (database !== null) {
                    database.close();
                    database = null;
                }

                wsServer = null;
                server = null;
            });
        };

        this.start = function start() {
            var future = Future.create(this);

            var db = new mongo.Db('ospy', new mongo.Server(options.database.host, options.database.port, {}), {w: 1});
            db.open(function (error, client) {
                if (error) {
                    future.fulfill(error);
                    return;
                }
                database = client;

                client.collection('projects', function (error, c) {
                    if (error) {
                        future.fulfill(error);
                        return;
                    }
                    collection.projects = c;

                    client.collection('applications', function (error, c) {
                        if (error) {
                            future.fulfill(error);
                            return;
                        }
                        collection.applications = c;

                        server.listen(options.port, function () {
                            console.log("%s listening at %s, serving static content from %s", server.name, server.url, options.staticDir);
                            saveTimer = setInterval(saveAll, 5 * 60 * 1000);
                            future.fulfill(null);
                        });
                    });
                });
            });

            return future;
        };

        var onWebSocketRequest = function onWebSocketRequest(req) {
            var match = req.resourceURL.pathname.match(/^\/channel\/projects\/([^\/]+)$/);
            if (match !== null) {
                getProject(match[1]).when(function (error, project) {
                    if (error) {
                        req.reject(404, "Project Not Found");
                    } else {
                        var connection = req.accept(null, req.origin);
                        var session = new Session({connection: connection});
                        session.join(project);
                    }
                });
            } else {
                req.reject(404, "Handler Not Found");
            }
        };

        var getProject = function getProject(id) {
            var future = Future.create(this),
                projectId,
                project;
            if (id === 'undefined') {
                projectId = base62.encode(Math.floor(Math.random() * 0xffffffff));
                project = new Project(projectId, {
                    persisted: false,
                    database: options.database
                });
                projects[projectId] = project;
                console.log("New temporary project:", projectId);
                console.log("Projects alive now:", Object.keys(projects).length);
                project.once('suspendable', function () {
                    delete projects[projectId];
                    console.log("Projects alive now:", Object.keys(projects).length);
                });
                future.fulfill(null, project);
            } else {
                project = projects[id];
                if (project) {
                    future.fulfill(null, project);
                } else {
                    project = new Project(id, {
                        persisted: true,
                        database: options.database
                    });
                    project.load().when(function (error) {
                        if (error) {
                            future.fulfill(error);
                            return;
                        }
                        if (!projects[id]) {
                            projects[id] = project;
                            project.once('suspendable', function () {
                                delete projects[id];
                                console.log("Projects alive now:", Object.keys(projects).length);
                            });
                            console.log("Loaded published project:", id);
                            console.log("Projects alive now:", Object.keys(projects).length);
                        }
                        future.fulfill(null, projects[id]);
                    });
                }
            }
            return future;
        };

        var saveAll = function saveAll() {
            if (saving !== null) {
                return saving;
            }

            var future = Future.create(this);
            saving = future;

            var pending = Object.keys(projects).length;
            var errors = 0;
            var onComplete = function onComplete(error) {
                if (error) {
                    errors++;
                }
                pending--;
                if (pending === 0) {
                    saving = null;
                    if (errors) {
                        future.fulfill("save failed");
                    } else {
                        future.fulfill(null);
                    }
                }
            }.bind(this);

            pending++;

            Object.keys(projects).forEach(function (projectId) {
                projects[projectId].save().when(onComplete);
            });

            onComplete(null);

            return future;
        }.bind(this);

        var Project = function Project(id, options) {
            var shuttingDown = false,
                applications = {},
                sessions = [],
                saving = null,
                suspendTimer = null;

            EventEmitter.call(this);

            applications['ospy:stream'] = new Stream(this);

            this.shutDown = function shutDown() {
                if (suspendTimer !== null) {
                    clearTimeout(suspendTimer);
                    suspendTimer = null;
                }
                shuttingDown = true;
            };

            this.load = function load() {
                var future = Future.create(this);
                collection.projects.findOne({'_id': id}, function (error, doc) {
                    if (error) {
                        future.fulfill(error);
                        return;
                    } else if (doc === null) {
                        future.fulfill("not found");
                        return;
                    }
                    var pending = Object.keys(applications).length;
                    var errors = 0;
                    var onComplete = function onComplete(error) {
                        if (error) {
                            errors++;
                        }
                        pending--;
                        if (pending === 0) {
                            if (errors) {
                                future.fulfill("load failed");
                            } else {
                                future.fulfill(null);
                            }
                        }
                    };
                    Object.keys(applications).forEach(function (appName) {
                        applications[appName].load().when(onComplete);
                    });
                });
                return future;
            };
            this.save = function save() {
                if (saving !== null) {
                    return saving;
                }

                var future = Future.create(this);
                saving = future;

                if (options.persisted) {
                    collection.projects.insert({
                        '_id': id,
                        'date_created': new Date()
                    }, function (error) {
                        if (error && error.code !== 11000) {
                            saving = null;
                            future.fulfill(error);
                            return;
                        }
                        var pending = Object.keys(applications).length;
                        var errors = 0;
                        var onComplete = function onComplete(error) {
                            if (error) {
                                errors++;
                            }
                            pending--;
                            if (pending === 0) {
                                saving = null;
                                if (errors) {
                                    future.fulfill("save failed");
                                } else {
                                    future.fulfill(null);
                                }
                            }
                        };
                        Object.keys(applications).forEach(function (appName) {
                            applications[appName].save().when(onComplete);
                        });
                    });
                } else {
                    saving = null;
                    future.fulfill("not published");
                }

                return future;
            };

            this.join = function join(session) {
                if (suspendTimer !== null) {
                    clearTimeout(suspendTimer);
                    suspendTimer = null;
                }

                sessions.push(session);
                Object.keys(applications).forEach(function (appName) {
                    applications[appName].onJoin(session);
                });
            };
            this.leave = function leave(session) {
                sessions.splice(sessions.indexOf(session), 1);
                Object.keys(applications).forEach(function (appName) {
                    applications[appName].onLeave(session);
                });

                if (!shuttingDown && sessions.length === 0) {
                    suspendTimer = setTimeout(function considerSuspend() {
                        suspendTimer = null;
                        this.save().when(function () {
                            if (sessions.length === 0) {
                                this.emit('suspendable');
                            }
                        });
                    }.bind(this), 5000);
                }
            };
            this.receive = function receive(stanza, session) {
                if (stanza.to === "/") {
                    if (stanza.name === '.publish') {
                        if (!options.persisted) {
                            options.persisted = true;
                            session.receive({
                                id: stanza.id,
                                from: "/",
                                name: '+result',
                                payload: {
                                    _id: id
                                }
                            });
                        } else {
                            session.receive({
                                id: stanza.id,
                                from: "/",
                                name: '+error',
                                payload: {
                                    error: "already published"
                                }
                            });
                        }
                    }
                } else {
                    var match = stanza.to.match(/^\/applications\/([^\/]+)$/);
                    if (match !== null) {
                        var app = applications[match[1]];
                        if (app) {
                            app.onStanza(stanza, session);
                        }
                    }
                }
            };
            this.broadcast = function broadcast(stanza) {
                for (var i = 0; i !== sessions.length; i++) {
                    sessions[i].receive(stanza);
                }
            };

            Object.defineProperty(this, 'id', {value: id});
        };
        util.inherits(Project, EventEmitter);

        var Stream = function Stream(project) {
            var appId = 'ospy:stream',
                appAddress = "/applications/" + appId,
                items = [],
                itemById = {},
                lastId = 0;

            this.load = function load() {
                var future = Future.create(this);
                collection.applications.findOne({
                    project: project.id,
                    application: appId,
                }, function (error, doc) {
                    if (error) {
                        future.fulfill(error);
                        return;
                    }
                    if (doc !== null) {
                        items = doc.state['items'];
                        lastId = doc.state['last_id'];
                        addToIndex(items);
                    } else {
                        items = [];
                        lastId = 0;
                    }
                    future.fulfill(null);
                });
                return future;
            };
            this.save = function save() {
                var future = Future.create(this);
                collection.applications.findOne({
                    project: project.id,
                    application: appId,
                }, function (error, doc) {
                    if (error) {
                        future.fulfill(error);
                        return;
                    }
                    if (doc === null) {
                        doc = {
                            project: project.id,
                            application: appId,
                        };
                    }
                    doc.state = {
                        'items': items,
                        'last_id': lastId
                    };
                    collection.applications.save(doc, function (error) {
                        future.fulfill(error);
                    });
                });
                return future;
            };

            this.onJoin = function onJoin(session) {
                send(session, '+sync', {total: items.length});
            };
            this.onLeave = function onLeave(/*session*/) {
            };
            this.onStanza = function onStanza(stanza, session) {
                switch (stanza.name) {
                    case '+clear':
                        items = [];
                        broadcast('+sync', {total: items.length});
                        break;
                    case '+add':
                        (function () {
                            var newItems = stanza.payload.items.map(function (item) {
                                return {
                                    _id: lastId++,
                                    timestamp: JSON.parse(JSON.stringify(new Date())),
                                    event: item.event,
                                    payload: item.payload
                                };
                            });
                            items.push.apply(items, newItems);
                            addToIndex(newItems);
                            broadcast('+update', {total: items.length});
                        }).call(this);
                        break;
                    case '.get':
                        (function () {
                            var result = [];
                            var requestedItems = stanza.payload.items;
                            for (var i = 0; i !== requestedItems.length; i++) {
                                var item = itemById[requestedItems[i]._id];
                                if (item) {
                                    result.push(item);
                                } else {
                                    session.receive({
                                        id: stanza.id,
                                        from: appAddress,
                                        name: '+error',
                                        payload: {}
                                    });
                                    return;
                                }
                            }
                            session.receive({
                                id: stanza.id,
                                from: appAddress,
                                name: '+result',
                                payload: result
                            });
                        }).call(this);
                        break;
                    case '.get-at':
                        (function () {
                            var result = [];
                            var requestedIndexes = stanza.payload.indexes;
                            for (var i = 0; i !== requestedIndexes.length; i++) {
                                var item = items[requestedIndexes[i]];
                                if (item) {
                                    result.push(item);
                                } else {
                                    session.receive({
                                        id: stanza.id,
                                        from: appAddress,
                                        name: '+error',
                                        payload: {}
                                    });
                                    return;
                                }
                            }
                            session.receive({
                                id: stanza.id,
                                from: appAddress,
                                name: '+result',
                                payload: result
                            });
                        }).call(this);
                        break;
                    case '.get-range':
                        (function () {
                            var startIndex = stanza.payload['start_index'],
                                limit = stanza.payload['limit'],
                                result;
                            result = items.slice(startIndex, startIndex + limit);
                            session.receive({
                                id: stanza.id,
                                from: appAddress,
                                name: '+result',
                                payload: result
                            });
                        }).call(this);
                        break;
                }
            };

            var addToIndex = function addToIndex(items) {
                items.forEach(function (item) {
                    itemById[item._id] = item;
                });
            };

            var send = function send(session, name, payload) {
                session.receive({
                    from: appAddress,
                    name: name,
                    payload: payload
                });
            };
            var broadcast = function broadcast(name, payload) {
                project.broadcast({
                    from: appAddress,
                    name: name,
                    payload: payload
                });
            };
        };

        var Session = function Session(options) {
            var connection = options.connection,
                project;

            this.join = function join(p) {
                project = p;
                p.join(this);
            };
            this.receive = function receive(stanza) {
                connection.sendUTF(JSON.stringify(stanza));
            };

            var initialize = function initialize() {
                connection.once('close', onConnectionClose);
                connection.on('message', onConnectionMessage);
            };
            var onConnectionClose = function onConnectionClose() {
                project.leave(this);
                connection.removeListener('message', onConnectionMessage);
            }.bind(this);
            var onConnectionMessage = function onConnectionMessage(message) {
                if (message.type === 'utf8' && message.utf8Data.length !== 0) {
                    try {
                        var stanza = JSON.parse(message.utf8Data);
                        project.receive(stanza, this);
                    } catch (e) {
                        console.log("Error processing message. Closing connection.");
                        connection.close();
                    }
                }
            }.bind(this);

            initialize();
        };

        initialize();
    };


    var server = new Server({
        port: 8000,
        staticDir: path.join(__dirname, "..", "src"),
        database: {
            host: "127.0.0.1",
            port: 27017
        }
    });
    server.start().when(function (error) {
        if (error) {
            console.log("Failed to start server:", error);
            server.dispose();
            return;
        }
        console.log("Server started!");
        console.log("Hit ENTER to stop.");
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', function () {
            process.stdin.pause();
            console.log("Stopping server.");
            server.dispose();
            server = null;
        });
    });
})();
