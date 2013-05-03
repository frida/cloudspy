define(function () {
    'use strict';

    return function extend(properties) {
        var parent = this;
        var child = function () {
            return parent.apply(this, arguments);
        };

        Object.keys(parent).forEach(function (key) {
            child[key] = parent[key];
        });

        var Surrogate = function () { this.constructor = child; };
        Surrogate.prototype = parent.prototype;
        child.prototype = new Surrogate();

        Object.keys(properties).forEach(function (key) {
            child.prototype[key] = properties[key];
        });

        child['__super__'] = parent.prototype;

        return child;
    };
});
