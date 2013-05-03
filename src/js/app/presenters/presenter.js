define(['extend'], function (extend) {
    'use strict';

    var Presenter = function Presenter(view, services) {
        if (view) {
            this.view = view;
        } else {
            this.view = null;
        }
        this.services = services;
        this.initialize.apply(this, [].slice.call(arguments, 2));
    };
    Presenter.prototype = {
        initialize: function initialize() {},
        dispose: function dispose() {}
    };
    Presenter.define = extend;

    return Presenter;
});
