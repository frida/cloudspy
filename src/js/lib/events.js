define(function () {
    'use strict';

    var Events = function Events() {
        this.listeners = {};
    };

    Events.prototype.on = function on(event, listener) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(listener);
        return listener;
    };

    Events.prototype.off = function off(event, listener) {
        if (this.listeners[event]) {
            this.listeners[event] = this.listeners[event].filter(function (element) {
                return element !== listener;
            });
        }
        return listener;
    };

    Events.prototype.trigger = function trigger() {
        var event = arguments[0],
            args = Array.prototype.slice.call(arguments, 1),
            listeners = this.listeners[event] || [];
        listeners.forEach(function (listener) {
            listener.apply(null, args);
        });
        return listeners.length;
    };

    return Events;
});
