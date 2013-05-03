define(['app/services/service'], function (Service) {
    'use strict';

    var Navigation = Service.define({
        initialize: function initialize() {
            if (hasPushState) {
                if (window.location.hash.indexOf("#!/") === 0) {
                    this.location = getHashPath();
                    window.location.replace(getRoot() + unparsePath(this.location));
                } else {
                    this.location = getPath();
                    window.location.hash = "";
                }
                window.addEventListener('popstate', this, false);
            } else {
                if (window.location.pathname.length > 1) {
                    this.location = getLocationPath();
                    window.location.replace(getRoot() + "/#!" + unparsePath(this.location));
                } else {
                    this.location = getPath();
                }
                window.addEventListener('hashchange', this, false);
            }

            this._onAnchorClick = this._onAnchorClick.bind(this);
            document.addEventListener('click', this._onAnchorClick, false);
        },
        dispose: function dispose() {
            document.removeEventListener('click', this._onAnchorClick, false);
            if (hasPushState) {
                window.removeEventListener('popstate', this, false);
            } else {
                window.removeEventListener('hashchange', this, false);
            }
            Navigation['__super__'].dispose.call(this);
        },
        url: function url(path) {
            return hasPushState ? unparsePath(path) : "#!" + unparsePath(path);
        },
        update: function update(path) {
            if (unparsePath(path) !== unparsePath(this.location)) {
                if (hasPushState) {
                    window.history.pushState(null, null, unparsePath(path));
                    this.location = path.slice(0);
                    this.services.bus.post('services.navigation:location-updated', this.location);
                } else {
                    window.location.hash = "#!" + unparsePath(path);
                }
            }
        },
        handleEvent: function handleEvent(event) {
            if (event.type === 'popstate' || event.type === 'hashchange') {
                var location = getPath();
                if (unparsePath(location) !== unparsePath(this.location)) {
                    this.location = location;
                    this.services.bus.post('services.navigation:location-updated', this.location);
                }
            }
        },
        _onAnchorClick: function _onAnchorClick(event) {
            var current = event.target,
                anchor = null;

            while (current && anchor === null) {
                if (current.tagName === "A") {
                    anchor = current;
                }
                current = current.parentElement;
            }

            if (anchor !== null) {
                var href = anchor.getAttribute('href');
                if (href && href.indexOf("/") === 0) {
                    try {
                        this.update(parsePath(href));
                    } catch (e) {
                        console.error("Navigation#update failed:", e.stack);
                    }
                    event.preventDefault();
                }
            }
        }
    });

    var hasPushState = window.history && window.history.pushState;

    var getRoot = function getRoot() {
        return window.location.protocol + "//" + window.location.host;
    };

    var getPath = function getPath() {
        return hasPushState ? getLocationPath() : getHashPath();
    };

    var getHashPath = function getHashPath() {
        if (window.location.hash.indexOf("#!/") === 0) {
            return parsePath(window.location.hash.substring(2));
        } else {
            return [];
        }
    };

    var getLocationPath = function getLocationPath() {
        if (window.location.pathname.length > 1) {
            return parsePath(window.location.pathname);
        } else {
            return [];
        }
    };

    var parsePath = function parsePath(path) {
        var components = path.split("/"),
            result = [];
        for (var i = 0; i < components.length; i++) {
            if (components[i] !== "") {
                result.push(decodeURIComponent(components[i]));
            }
        }
        return result;
    };

    var unparsePath = function unparsePath(path) {
        return "/" + path.join("/");
    };

    return Navigation;
});
