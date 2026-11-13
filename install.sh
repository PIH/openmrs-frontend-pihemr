#!/bin/bash

usage () {
    echo -e "Usage: install.sh SERVER [COUNTRY]\n"
    echo -e "Installs the frontend to SERVER, where a server is the name of an OpenMRS SDK instance at path '~/openmrs/[SERVER]'\n"
    echo -e "Also symlinks the frontend config from the configuration directory.\n"
    echo -e "If there is a spa-build-config.<COUNTRY>.json for the server's country, the importmap and routes registry"
    echo -e "built for it are installed. COUNTRY (e.g. sierraLeone) is the property.frontend_pihemr.country entry in the"
    echo -e "server's openmrs-distro.properties (copied there from the distro), unless given as the second argument.\n"
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
# Use the importmap and routes registry built for this server's country, if it has its own
# spa-build-config.<COUNTRY>.json. This is the value a distro sets as property.frontend_pihemr.country.
SERVER_DIR=~/openmrs/$1
COUNTRY=$2
if [ -z "$COUNTRY" ]; then
    # set by the distro; the SDK copies the distro's openmrs-distro.properties into the server directory
    COUNTRY=$(sed -n 's/^property\.frontend_pihemr\.country=//p' "$SERVER_DIR/openmrs-distro.properties" 2>/dev/null)
fi
if [ -n "$COUNTRY" ] && [ -f "target/dist/importmap.$COUNTRY.json" ]; then
    echo "Using the importmap and routes registry for '$COUNTRY'"
    # the .gz and .br siblings too: the SPA module serves precompressed files in preference to the original
    for f in "$SERVER_DIR"/frontend/importmap.$COUNTRY.json* "$SERVER_DIR"/frontend/routes.registry.$COUNTRY.json*; do
        cp "$f" "${f/.$COUNTRY.json/.json}"
    done
else
    echo "No country-specific importmap for '${COUNTRY}'; using the default"
fi

for f in ~/openmrs/$1/configuration/frontend/*; do
    ln -s "$f" ~/openmrs/$1/frontend/"$(basename "$f")"
done
