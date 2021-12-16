#!/bin/bash

usage () {
    echo -e "Usage: install.sh [SERVER]\n"
    echo -e "Installs the frontend to SERVER, where a server is the name of an OpenMRS SDK instance at path '~/openmrs/[SERVER]'\n"
    echo -e "Example: ./install.sh mirebalais\n"
}

if [ $# -eq 0 ]; then
    echo -e "Please provide the name of the server to install to as a command line argument.\n"
    usage
    exit 1
fi

mvn clean compile
rm -r ~/openmrs/$1/frontend
cp -r target/dist ~/openmrs/$1/frontend
