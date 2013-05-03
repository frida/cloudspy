define(['app/presenters/presenter'], function (Presenter) {
    'use strict';

    var Session = Presenter.define({
        initialize: function initialize(parent, deviceId, processId) {
            this._parent = parent;

            this._onDetach = this._onDetach.bind(this);
            this._onClose = this._onClose.bind(this);

            Object.defineProperty(this, 'deviceId', {value: deviceId});
            Object.defineProperty(this, 'processId', {value: processId});

            this._session = this.services.frida.getSession(deviceId, processId);

            this.view.update({
                attached: false,
                error: null
            });
            this._handler = {
                attach: function handleAttach() {
                    this.view.update({attached: true});
                },
                detach: function handleDetach(error) {
                    this.view.update({
                        attached: false,
                        error: error
                    });
                },
                event: function handleEvent(event, payload) {
                    parent._onEvent(this, event, payload);
                }
            };
            this._session.addHandler(this._handler, this);

            this.view.events.on('detach', this._onDetach);
            this.view.events.on('close', this._onClose);
        },
        dispose: function dispose() {
            this.view.events.off('detach', this._onDetach);
            this.view.events.off('close', this._onClose);

            this._session.removeHandler(this._handler);

            Session['__super__'].dispose.call(this);
        },
        attach: function attach() {
            this._session.attach();
        },
        _onDetach: function _onDetach() {
            this._session.detach();
        },
        _onClose: function _onClose() {
            this._parent._deleteSession(this);
        }
    });

    return Session;
});
