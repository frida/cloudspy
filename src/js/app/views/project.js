define(['app/views/template', 'app/views/capture', 'app/views/stream', 'text!templates/project.html'], function (Template, Capture, Stream, template) {
    'use strict';

    var Project = Template.define({
        initialize: function initialize() {
            Project['__super__'].initialize.call(this, '/project', template);

            this.capture = new Capture(this.element.querySelector("[data-view='capture']"), this);
            this.stream = new Stream(this.element.querySelector("[data-view='stream']"));

            this._connect("[data-action='publish']", 'click', this._onPublishBtnClick);
        },
        dispose: function dispose() {
            this.stream.dispose();
            this.capture.dispose();

            Project['__super__'].dispose.call(this);
        },
        resume: function resume() {
            this.render();
        },
        render: function render() {
            this.stream.resume();
        },
        _onPublishBtnClick: function _onPublishBtnClick() {
            this.events.trigger('publish');
        }
    });

    return Project;
});
