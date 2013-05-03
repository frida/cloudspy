define(['app/presenters/presenter'], function (Presenter) {
    'use strict';

    var Summary = Presenter.define({
        initialize: function initialize(parent, stream) {
            this._parent = parent;
            this._stream = stream;
            this._loaded = false;
            this._lastGetSeq = 0;

            this.view.presenter = this;

            this._handler = {
                update: function handleUpdate() {
                    this._loaded = true;
                    this.view.render();
                }
            };
            this._stream.addHandler(this._handler, this);

            this._onSelect = this._onSelect.bind(this);
            this.view.events.on('select', this._onSelect);
        },
        dispose: function dispose() {
            this.view.events.off('select', this._onSelect);

            this._stream.removeHandler(this._handler);

            Summary['__super__'].dispose.call(this);
        },
        getTotal: function getTotal() {
            if (this._loaded) {
                return this._stream.state.total;
            } else {
                return -1;
            }
        },
        getItems: function getItems(startIndex, limit) {
            this._lastGetSeq++;
            var seq = this._lastGetSeq;
            return this._stream.getCachedRange(startIndex, limit, function (error, result) {
                if (!error && result.source === 'server' && seq === this._lastGetSeq) {
                    this.view.render();
                }
            }.bind(this));
        },
        _onSelect: function _onSelect(indexes) {
            indexes = indexes.slice(0).sort(function (a, b) {
                return a - b;
            });
            this._parent.details.load(indexes);
        }
    });

    return Summary;
});
