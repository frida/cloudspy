//>>excludeStart('productionExclude', pragmas.productionExclude);
require.config({
    baseUrl: "/",
    urlArgs: "_=" + (new Date()).getTime(),
    paths: {
        'less':         "vendor/less",
        'lcss':         "vendor/lcss",
        'text':         "vendor/text",
        'deferred':     "js/lib/deferred",
        'events':       "js/lib/events",
        'extend':       "js/lib/extend",
        'lru':          "js/lib/lru",
        'app':          "js/app",
        'css':          "css"
    },
    shim: {
        'lcss': { deps: ['less'] }
    }
});
//>>excludeEnd('productionExclude');
require(['app/views/app', 'app/presenters/app', 'app/services/messagebus', 'app/services/storage', 'app/services/settings', 'app/services/navigation', 'app/services/ospy', 'app/services/frida', 'lcss!css/app'], function onLoad(AppView, AppPresenter, MessageBus, Storage, Settings, Navigation, OSpy, Frida) {
    'use strict';

    var view,
        presenter,
        services = {};

    services.bus = new MessageBus(services);
    services.storage = new Storage(services);
    services.settings = new Settings(services, ['ospy.host'], window.AppConfig);
    services.navigation = new Navigation(services);
    services.ospy = new OSpy(services);
    services.frida = new Frida(services);

    view = new AppView(document.getElementById('main'));
    presenter = new AppPresenter(view, services);

    window.app = presenter;
    window.addEventListener('unload', function onUnload() {
        delete window.app;
        presenter.dispose();
        view.dispose();
        for (var name in services) {
            if (services.hasOwnProperty(name)) {
                services[name].dispose();
            }
        }
    });
});
