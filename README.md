# openmrs-frontend-pihemr

This package builds the OpenMRS 3.x frontend used by PIH EMR.
The frontend build tools are used by Maven to build the frontend bundle.

This can be used with a local SDK server by running the `./install.sh` script.
This builds the frontend bundle and copies it into the server `frontend/` directory.

When this package is built and deployed, the deployed artifact can be used in a
distribution by downloading it and unpacking it into the server `frontend/` directory.

## Country-specific frontend modules

Each distribution can have its own list of frontend modules.

- `spa-build-config.json` is the default list, used by any distribution without one of its own.
- `spa-build-config.<country>.json` is the complete list for one country's distribution. `<country>` is
  `sierraLeone`, `haiti` (the ZL distribution), `liberia`, `lesotho` or `malawi`, the same value the distribution
  sets as `property.frontend_pihemr.country` in its `openmrs-distro.properties`.
  - Only `frontendModules` is read from these files; `configUrls` and
    the rest come from `spa-build-config.json`. This is because there is a single `openmrs build`, which bakes `configUrls` (and the other build settings) into the one `index.html` that every country shares, so they can't differ
    per country. Only the importmap and routes registry can, which is why the per-country files only
    vary the module list. (Per-country values would need a separate `openmrs build`, and a country-specific `index.html`, for each country.)

The build (`scripts/country-build-configs.mjs`, run by Maven) merges the module lists of all of these files into
one config for `openmrs assemble`, so each module is downloaded once; the same module must have the same version in
every file. After the build, `importmap.json` and `routes.registry.json` contain only the default list, and
`importmap.<country>.json` and `routes.registry.<country>.json` (each with `.gz`/`.br` siblings) contain
each country's list. Modules that only some countries need are in the zip, but only referenced by those countries.

### Using a country's importmap in a distribution

A distribution needs two things:

- the line `property.frontend_pihemr.country=<country>` (the `<country>` above) in its `openmrs-distro.properties`.
  This is the single source of truth: the SDK copies this file into each server it sets up (`openmrs-distro.properties`
  in the server directory), where `install.sh` reads it, and the `pom.xml` step below reads it;
- an extra step in its `pom.xml` (`maven-antrun-plugin`, after the SDK `build-distro`) that copies `importmap.<country>.json` and
  `routes.registry.<country>.json` over `importmap.json` and `routes.registry.json` in
  `target/distro/web/openmrs_spa`. Copy the `.gz`/`.br` files too, since the SPA module serves a precompressed
  file in preference to the original. If there is no file for the country, nothing is copied and the default is used.

See the `select-country-importmap` execution in e.g. the `pihmalawi-emr` distro `pom.xml`.

`./install.sh SERVER` (local SDK server) does the same, reading the country from the
`property.frontend_pihemr.country` line in the server's `openmrs-distro.properties`. Servers set up before the
distribution added that line don't have it, so they use the default importmap until the line is added (or the server is
upgraded from the distro). A second optional argument sets the country explicitly.
