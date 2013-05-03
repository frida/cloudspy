define(function () {
    'use strict';

    return {
        update: function update(target, updates) {
            Object.keys(updates).forEach(function (key) {
                var value = updates[key];
                if (value === null) {
                    delete target[key];
                } else if ((typeof value !== 'object') || (value instanceof Array)) {
                    target[key] = value;
                } else if (target[key] == null) {
                    target[key] = value;
                } else {
                    update(target[key], value);
                }
            });
        },
        bind: function bind(callbacks, context) {
            Object.keys(callbacks).forEach(function (key) {
                var value = callbacks[key];
                if (typeof value === 'function') {
                    callbacks[key] = value.bind(context);
                }
            });
            return callbacks;
        }
    };
});
