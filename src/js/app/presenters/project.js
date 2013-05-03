define(['app/presenters/presenter', 'app/presenters/capture', 'app/presenters/stream', 'deferred'], function (Presenter, Capture, Stream, Deferred) {
    'use strict';

    var Project = Presenter.define({
        initialize: function initialize(app, id) {
            this._project = this.services.ospy.get(id);
            this._loading = new Deferred();

            this.capture = new Capture(this.view.capture, this.services, this._project);
            this.stream = new Stream(this.view.stream, this.services, this._project);

            this._handler = {
                join: function handleJoin() {
                    Deferred.when(this.view.update({published: !!id}), this.capture.load(), this.stream.load()).done(function () {
                        this._loading.resolve();
                    }.bind(this)).fail(function () {
                        this._loading.reject();
                    }.bind(this));
                },
                leave: function handleLeave() {
                    if (this._loading.state() === 'pending') {
                        this._loading.reject();
                    } else {
                        app.suspendPage(this);
                    }
                }
            };
            this._project.addHandler(this._handler, this);

            this._onPublish = this._onPublish.bind(this);
            this.view.events.on('publish', this._onPublish);
        },
        dispose: function dispose() {
            this.view.events.off('publish', this._onPublish);

            this._project.removeHandler(this._handler);

            this.stream.dispose();
            this.capture.dispose();

            Project['__super__'].dispose.call(this);
        },
        resume: function resume() {
            return this._loading.promise();
        },
        suspend: function suspend() {
            return true;
        },
        _onPublish: function _onPublish() {
            this._project.publish().done(function (project) {
                this.services.navigation.update(['p', project._id]);
            }.bind(this));
        }
    });

    return Project;
});
