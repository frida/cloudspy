define(['app/presenters/presenter', 'app/views/capture/session', 'app/presenters/capture/session', 'deferred'], function (Presenter, SessionView, SessionPresenter, Deferred) {
    'use strict';

    var Capture = Presenter.define({
        initialize: function initialize(project) {
            this._project = project;
            this._sessions = [];
            this._previouslySelectedDevice = null;
            this._items = [];
            this._itemsTimer = null;
            this._loading = new Deferred();

            this._onDeviceSelected = this._onDeviceSelected.bind(this);
            this._onAttach = this._onAttach.bind(this);
            this.view.events.on('device-selected', this._onDeviceSelected);
            this.view.events.on('attach', this._onAttach);

            this._handler = {
                enable: function enable() {
                    this.view.update({'frida-enabled': true});
                },
                disable: function disable() {
                    this.view.update({'frida-enabled': false});
                    if (this._loading.state() === 'pending') {
                        this.view.flushUpdates();
                        this._loading.resolve();
                    }
                },
                update: function update() {
                    this.view.update({devices: this.services.frida.devices});
                    if (this._loading.state() === 'pending') {
                        this.view.flushUpdates();
                        this._loading.resolve();
                    }
                }
            };
            this.services.frida.addHandler(this._handler, this);
        },
        dispose: function dispose() {
            this.services.frida.removeHandler(this._handler);

            this.view.events.off('attach', this._onAttach);
            this.view.events.off('device-selected', this._onDeviceSelected);

            for (var i = 0; i !== this._sessions.length; i++) {
                var session = this._sessions[i];
                session.dispose();
                session.view.dispose();
            }

            window.clearTimeout(this._itemsTimer);

            Capture['__super__'].dispose.call(this);
        },
        load: function load() {
            return this._loading.promise();
        },
        _onDeviceSelected: function _onDeviceSelected(deviceId) {
            this.services.frida.enumerateProcesses(deviceId).done(function updateProcesses(processes) {
                this.view.update({processes: processes});
                this._previouslySelectedDevice = deviceId;
            }.bind(this)).fail(function (error) {
                this.view.displayError(error);
                if (this._previouslySelectedDevice !== null) {
                    var fallbackDevice = this._previouslySelectedDevice;
                    this._previouslySelectedDevice = null;
                    this.view.selectDevice(fallbackDevice);
                } else {
                    this.view.update({processes: []});
                }
            }.bind(this));
        },
        _onAttach: function _onAttach(deviceId, processId) {
            var presenter = null;
            for (var i = 0; i !== this._sessions.length && presenter === null; i++) {
                var p = this._sessions[i];
                if (p.deviceId === deviceId && p.processId === processId) {
                    presenter = p;
                }
            }
            if (presenter === null) {
                var view = new SessionView();
                presenter = new SessionPresenter(view, this.services, this, deviceId, processId);
                this._sessions.push(presenter);
                this.view.addSession(view);
            } else {
                presenter.attach();
            }
        },
        _deleteSession: function _deleteSession(session) {
            this.view.removeSession(session.view);
            this._sessions.splice(this._sessions.indexOf(session), 1);
            session.dispose();
            session.view.dispose();
        },
        _onEvent: function _onEvent(session, event, payload) {
            var data;
            if (payload) {
                data = payload.toString('base64');
            } else {
                data = null;
            }
            var item = {
                event: event,
                payload: data
            };
            this._items.push(item);

            if (this._itemsTimer === null) {
                this._itemsTimer = window.setTimeout(function deliverItems() {
                    this._itemsTimer = null;
                    this._project.stream.add(this._items);
                    this._items = [];
                }.bind(this), 50);
            }
        }
    });

    return Capture;
});
