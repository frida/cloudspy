all: lint build

lint:
	@grunt lint

build:
	@grunt build

deploy: build
	rsync -rltDzv --delete build/www/ ospy@ospy.org:/home/ospy/www/ --exclude '.*'

.PHONY: all lint build deploy
