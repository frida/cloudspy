define(['app/presenters/presenter', 'app/views/project', 'app/presenters/project'], function (Presenter, ProjectView, ProjectPresenter) {
    'use strict';

    var App = Presenter.define({
        initialize: function initialize() {
            this.view.resume();
            this.view.update({
                loading: true,
                error: null
            });
            this._currentPage = null;
            this._pages = {};
            this._onLocationUpdated = this._onLocationUpdated.bind(this);
            this.services.bus.on('services.navigation:location-updated', this._onLocationUpdated);
            this._onLocationUpdated(this.services.navigation.location);
        },
        dispose: function dispose() {
            var pages = this._pages;
            this._pages = {};
            for (var pageId in pages) {
                if (this._pages.hasOwnProperty(pageId)) {
                    var page = this._pages[pageId];
                    page.dispose();
                    page.view.dispose();
                }
            }
            this.services.bus.off('services.navigation:location-updated', this._onLocationUpdated);
            App['__super__'].dispose.call(this);
        },
        suspendPage: function suspendPage(page) {
            var deletable = null;
            for (var pageId in this._pages) {
                if (this._pages.hasOwnProperty(pageId)) {
                    var p = this._pages[pageId];
                    if (p === page) {
                        if (page.suspend()) {
                            page.dispose();
                            page.view.dispose();
                            deletable = pageId;
                        }
                        break;
                    }
                }
            }

            if (deletable !== null) {
                delete this._pages[deletable];
                if (deletable === this._currentPage) {
                    this._currentPage = null;
                    this.view.update({
                        loading: true,
                        error: null
                    });
                    this.services.navigation.update([]);
                }
            }
        },
        _onLocationUpdated: function _onLocationUpdated(location) {
            var pageId = location.join('/'),
                page = this._pages[pageId];

            if (!page) {
                if (location.length === 0) {
                    page = new ProjectPresenter(new ProjectView(), this.services, this, undefined);
                } else if (location.length === 2 && location[0] === 'p' && location[1]) {
                    page = new ProjectPresenter(new ProjectView(), this.services, this, location[1]);
                }
            }

            if (this._pages[this._currentPage] && this._pages[this._currentPage].view.suspend) {
                this._pages[this._currentPage].view.suspend();
            }

            if (page) {
                var request,
                    deletable = [],
                    id,
                    p,
                    i;

                this._currentPage = pageId;
                this._pages[pageId] = page;
                this.view.update({
                    loading: true,
                    error: null
                });
                this.view.show(page.view);

                request = page.resume();
                request.done(function () {
                    if (this._currentPage === pageId) {
                        this.view.update({
                            loading: false,
                            error: null
                        }).done(function pageUpdated() {
                            if (page.view.resume) {
                                page.view.resume();
                            }
                        });
                    }
                }.bind(this));
                request.fail(function () {
                    if (this._currentPage === pageId) {
                        if (pageId) {
                            this.services.navigation.update([]);
                        } else {
                            page.dispose();
                            page.view.dispose();
                            delete this._pages[pageId];
                            this._currentPage = null;
                            this.view.update({
                                loading: false,
                                error: "An error occurred. Please try again later."
                            });
                        }
                    }
                }.bind(this));

                for (id in this._pages) {
                    if (this._pages.hasOwnProperty(id)) {
                        p = this._pages[id];
                        if (id !== pageId && p.suspend()) {
                            deletable.push(id);
                        }
                    }
                }

                for (i = 0; i < deletable.length; i++) {
                    id = deletable[i];
                    p = this._pages[id];
                    delete this._pages[id];
                    p.dispose();
                    p.view.dispose();
                }
            } else {
                this.services.navigation.update([]);
            }
        }
    });

    return App;
});
