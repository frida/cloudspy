define(['app/services/service'], function (Service) {
    'use strict';

    var lookup = function lookup(properties, key) {
        var path = key.split('.');
        var value = properties;
        for (var i = 0; i < path.length; i++) {
            if (value === undefined) {
                return undefined;
            }
            value = value[path[i]];
        }
        return value;
    };

    var Settings = Service.define({
        initialize: function initialize(sessionSettings, defaults) {
            this.get = function get(key) {
                var scope = (sessionSettings.indexOf(key) > 0) ? 'session' : 'local';
                var result = this.services.storage.load(scope, key);
                if (result !== undefined) {
                    return result;
                } else {
                    return lookup(defaults, key);
                }
            };
            this.put = function put(key, value) {
                var scope = (sessionSettings.indexOf(key) > 0) ? 'session' : 'local';
                this.services.storage.store(scope, key, value);

                var updates = {};
                updates[key] = value;
                this.services.bus.post('services.settings:settings-updated', updates);
            };
        }
    });

    return Settings;
});
