define(['app/presenters/presenter'], function (Presenter) {
    'use strict';

    var Details = Presenter.define({
        initialize: function initialize(parent, stream) {
            this._parent = parent;
            this._stream = stream;
            this._handler = {
                update: function handleUpdate(data, isPartial) {
                    if (!isPartial) {
                        this.view.clear();
                    }
                }
            };
            this._stream.addHandler(this._handler, this);
        },
        dispose: function dispose() {
            this._stream.removeHandler(this._handler);

            Details['__super__'].dispose.call(this);
        },
        load: function load(indexes) {
            this._stream.getAt(indexes).done(function (items) {
                this.view.clear();
                this.view.add(items);
            }.bind(this));
        }
    });

    return Details;
});
