define(['extend'], function (extend) {
    'use strict';

    var Service = function Service(services) {
        this._private = {};
        this.services = services;
        this.initialize.apply(this, [].slice.call(arguments, 1));
    };
    Service.prototype = {
        initialize: function initialize() {},
        dispose: function dispose() {}
    };
    Service.define = extend;

    return Service;
});
