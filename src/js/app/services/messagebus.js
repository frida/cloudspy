define(['app/services/service', 'events'], function (Service, Events) {
    'use strict';

    var MessageBus = Service.define({
        initialize: function initialize() {
            this._private.events = new Events();
        },
        on: function on(type, callback) {
            this._private.events.on(type, callback);
        },
        off: function off(type, callback) {
            this._private.events.off(type, callback);
        },
        post: function post(type, message) {
            this._private.events.trigger(type, message);
        }
    });

    return MessageBus;
});
