define(['app/services/service'], function (Service) {
    'use strict';

    var getStorage = function getStorage(scope) {
        if (scope === 'local') {
            return window.localStorage;
        } else {
            return window.sessionStorage;
        }
    };

    var Storage = Service.define({
        store: function store(scope, key, value) {
            var storage = getStorage(scope);
            if (value !== null) {
                storage.setItem(key, JSON.stringify(value));
            } else {
                storage.removeItem(key);
            }
        },
        load: function load(scope, key) {
            var value = getStorage(scope).getItem(key);
            return (value !== null) ? JSON.parse(value) : undefined;
        }
    });

    return Storage;
});
