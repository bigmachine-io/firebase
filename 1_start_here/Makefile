serve:
	bundle exec middleman

build:
	bundle exec middleman build

functions:
	firebase deploy --only functions 

web: build 
	firebase deploy --only hosting 

deploy:
	firebase deploy --except database
	
.PHONY: build web deploy functions