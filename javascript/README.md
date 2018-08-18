# javascript urdf-loader

[![npm version](https://badge.fury.io/js/urdf-loader.svg)](https://www.npmjs.com/package/urdf-loader)

Utilities for loading URDF files into THREE.js and a Web Component that loads and renders the model.

[Demo here!](https://gkjohnson.github.io/urdf-loaders/javascript/example/index.bundle.html)

![Example](/javascript/docs/javascript-example.gif)

## URDFLoader
```html
<script src=".../URDFLoader.js"></script>
<script>
  const manager = new THREE.LoadingManager();
  const loader = new URDFLoader(manager);
  loader.load(
    '.../package/dir/',           // The equivelant of a (list of) ROS package(s):// directory
    'T12/urdf/T12.URDF',          // The path to the URDF within the package OR absolute
    robot => { },                 // The robot is loaded!
    (path, ext, done) => { },     // Callback for each mesh for custom mesh processing and loading code
   );
</script>
```

### Limitations
- Only `prismatic`, `continuous`, `revolute`, and `fixed` joints are supported.
- Collision tags are not parsed.

### API
#### URDFLoader(manager)

Constructor

##### manager

THREE.LoadingManager. Used for transforming load URLs.

#### URDFLoader.load(package, urdfpath, robotsCallback, geometryLoader, fetchOptions)

Loads and builds the specified URDF robot in THREE.js

##### package

_required_

The path representing the `package://` directory(s) to load `package://` relative files.

If the argument is a string, then it is used to replace the `package://` prefix when loading geometry. To specify multiple packages an object syntax used defining the package name to the package path:
```js
{
  "package1": ".../path/to/package1",
  "package2": ".../path/to/package2",
  ...
}
```

##### urdf

_required_

The path to the URDF file relative to the specified package directory.

##### robotCallback(robot)

_required_

Callback that is called once the urdf robots have been loaded. The loaded robot is passed to the function.

The available joints are specified on `robot.urdf.joints`.

To set a joint angle, call `robot.urdf.joint.setAngle(angle)`.

##### geometryLoader(pathToModel, fileExtension, doneCallback)

_optional_

An optional function that can be used to override the default mesh loading functionality. The default loader is specified at `URDFLoader.defaultMeshLoader`. `doneCallback` is called with the mesh once the geometry has been loaded.

##### fetchOptions

_optional_

An optional object with the set of options to pass to the `fetch` function call used to load the URDF file.

## urdf-viewer Element
```html
<!-- Register the Element -->
<script href=".../urdf-viewer-element.js" />
<script>customElements.define('urdf-viewer', URDFViewer)</script>

<body>
  <urdf-viewer package=".../package/dir/" urdf="T12/urdf/T12.URDF" up="Z+" display-shadow ambient-color="red"></urdf-viewer>
</body>
```

### Attributes

#### package

Corresponds to the `package` parameter in `URDFLoader.load`. Supported are:

1. Single package:

    ```html
    // 1. Example for single package named `default_package`
    <urdf-viewer package=".../path/to/default_package" ...></urdf-viewer>
    ```

    Fallback within 1: If the target package within the `package://` relative files do not match the default path it is assumed that the default path is the parent folder that contains the target package(s).

    ```html
    // 1. Example for single package named `default_package` with fallback:
    <urdf-viewer package=".../path/to/parent" ...></urdf-viewer>
    // since `parent` does not match `default_package`
    // the path ".../path/to/parent/default_package" is assumed
    ```

2. Serialized package map:

    E.g. if the meshes of a URDF are distributed over mutliple packages.

    ```html
    // 2. Example for serialized package map that contains `package1` and `package2`
    <urdf-viewer package="package1:.../path/to/package1, package2:.../path/to/package1" ...></urdf-viewer>
    ```



#### urdf

Corresponds to the `urdfpath` parameter in `URDFLoader.load`.

The element uses fetch options `{ mode: 'cors', credentials: 'same-origin' }` to load the urdf file.

#### ignore-limits

Whether or not hte display should ignore the joint limits specified in the model when updating angles.

#### up

The axis to associate with "up" in THREE.js. Values can be [+-][XYZ].

#### display-shadow

Whether or not the render the shadow under the robot.

#### ambient-color

The color of the ambient light specified with css colors.

#### auto-redraw

Automatically redraw the model every frame instead of waiting to be dirtied.

### Properties

All of the above attributes have corresponding camel case properties.

#### angles

Sets or gets the angles of the robot as a dictionary of `joint-name` to `radian` pairs.

### Functions

#### setAngle(jointName, angle)

Sets the given joint to the provided angle in radians.

#### setAngles(jointDictionary)

Sets all joint names specified as keys to radian angle value.

#### redraw()

Dirty the renderer so the element will redraw next frame.

### Events

#### 'urdf-change'

Fires when the URDF has changed and a new one is starting to load.

#### 'ignore-limits-change'

Fires when the `ignore-limits` attribute changes.

#### 'urdf-processed'

Fires when the URDF has finished loading and getting processed.

#### 'geometry-loaded'

Fires when all the geometry has been fully loaded.

## Running the Example

Install Node.js and NPM.

Run `npm install`.

Run `npm run server`.

Visit `localhost:9080/javascript/example/` to view the page.

# LICENSE

The software is available under the [Apache V2.0 license](../LICENSE.txt).

Copyright © 2018 California Institute of Technology. ALL RIGHTS
RESERVED. United States Government Sponsorship Acknowledged. Any
commercial use must be negotiated with with Office of Technology
Transfer at the California Institute of Technology. This software may
be subject to U.S. export control laws. By accepting this software,
the user agrees to comply with all applicable U.S. export laws and
regulations. User has the responsibility to obtain export licenses,
or other export authority as may be required before exporting such
information to foreign countries or providing access to foreign
persons. Neither the name of Caltech nor its operating division, the
Jet Propulsion Laboratory, nor the names of its contributors may be
used to endorse or promote products derived from this software
without specific prior written permission.
