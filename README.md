# openmrs-frontend-pihemr

This package builds the OpenMRS 3.x frontend used by PIH EMR.
The frontend build tools are used by Maven to build the frontend bundle.

This can be used with a local SDK server by running the `./install.sh` script.
This builds the frontend bundle and copies it into the server `frontend/` directory.

When this package is built and deployed, the deployed artifact can be used in a
distribution by downloading it and unpacking it into the server `frontend/` directory.
