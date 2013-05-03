define(['app/presenters/presenter', 'app/presenters/stream/summary', 'app/presenters/stream/details', 'deferred'], function (Presenter, Summary, Details, Deferred) {
    'use strict';

    var Stream = Presenter.define({
        initialize: function initialize(project) {
            this._stream = project.stream;
            this._loading = new Deferred();

            this.summary = new Summary(this.view.summary, this.services, this, this._stream);
            this.details = new Details(this.view.details, this.services, this, this._stream);

            this._handler = {
                update: function handleUpdate(data, isPartial) {
                    if (!isPartial) {
                        if (this._loading.state() === 'pending') {
                            this._loading.resolve();
                        }
                    }

                    if ('total' in data) {
                        this.view.update({total: data.total});
                    }
                }
            };
            this._stream.addHandler(this._handler, this);

            this._onClear = this._onClear.bind(this);
            this.view.events.on('clear', this._onClear);
        },
        dispose: function dispose() {
            this.view.events.off('clear', this._onClear);

            this._stream.removeHandler(this._handler);

            Stream['__super__'].dispose.call(this);
        },
        load: function load() {
            return this._loading.promise();
        },
        _onClear: function _onClear() {
            this._stream.clear();
        }
    });

    return Stream;
});
