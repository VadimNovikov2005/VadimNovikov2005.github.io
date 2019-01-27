(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('three'), require('three/examples/js/loaders/STLLoader'), require('three/examples/js/loaders/ColladaLoader')) :
    typeof define === 'function' && define.amd ? define(['three', 'three/examples/js/loaders/STLLoader', 'three/examples/js/loaders/ColladaLoader'], factory) :
    (global.URDFLoader = factory(global.THREE,global.THREE,global.THREE));
}(this, (function (THREE,STLLoader,ColladaLoader) { 'use strict';

    class URDFRobot extends THREE.Object3D {

        constructor(...args) {

            super(...args);
            this.isURDFRobot = true;
            this.type = 'URDFRobot';
            this.urdfNode = null;

            this.links = null;
            this.joints = null;

        }

        copy(source, recursive) {

            super.copy(source, recursive);

            this.links = {};
            this.joints = {};

            this.traverse(c => {

                if (c.isURDFJoint && c.name in source.joints) {

                    this.joints[c.name] = c;

                }

                if (c.isURDFLink && c.name in source.links) {

                    this.links[c.name] = c;

                }

            });

            return this;

        }

    }

    class URDFLink extends THREE.Object3D {

        constructor(...args) {

            super(...args);
            this.isURDFLink = true;
            this.type = 'URDFLink';
            this.urdfNode = null;

        }

        copy(source, recursive) {

            super.copy(source, recursive);
            this.urdfNode = source.urdfNode;

            return this;

        }

    }

    class URDFJoint extends THREE.Object3D {

        get jointType() {

            return this._jointType;

        }
        set jointType(v) {

            if (this.jointType === v) return;
            this._jointType = v;

            switch (v) {

                case 'fixed':
                case 'continuous':
                case 'revolute':
                case 'prismatic':
                    this.jointValue = 0;
                    break;

                case 'planar':
                    this.jointValue = new Array(2).fill(0);
                    break;

                case 'floating':
                    this.jointValue = new Array(6).fill(0);
                    break;

            }

        }

        get angle() {

            return this.jointValue;

        }

        constructor(...args) {
            super(...args);

            this.isURDFJoint = true;
            this.type = 'URDFJoint';

            this.urdfNode = null;
            this.jointValue = null;
            this.jointType = 'fixed';
            this.axis = null;
            this.limit = { lower: 0, upper: 0 };
            this.ignoreLimits = false;

            this.origPosition = null;
            this.origQuaternion = null;
        }

        /* Overrides */
        copy(source, recursive) {

            super.copy(source, recursive);

            this.urdfNode = source.urdfNode;
            this.jointType = source.jointType;
            this.axis = source.axis ? source.axis.clone() : null;
            this.limit.lower = source.limit.lower;
            this.limit.upper = source.limit.upper;
            this.ignoreLimits = false;

            this.jointValue = Array.isArray(source.jointValue) ? [...source.jointValue] : source.jointValue;

            this.origPosition = source.origPosition ? source.origPosition.clone() : null;
            this.origQuaternion = source.origQuaternion ? source.origQuaternion.clone() : null;

            return this;
        }

        /* Public Functions */
        setAngle(...values) {
            return this.setOffset(...values);
        }

        setOffset(...values) {

            if (!this.origPosition || !this.origQuaternion) {

                this.origPosition = this.position.clone();
                this.origQuaternion = this.quaternion.clone();

            }

            switch (this.jointType) {

                case 'fixed': {
                    break;
                }
                case 'continuous':
                case 'revolute': {

                    let angle = values[0];
                    if (angle == null) break;
                    if (angle === this.jointValue) break;

                    if (!this.ignoreLimits) {

                        angle = Math.min(this.limit.upper, angle);
                        angle = Math.max(this.limit.lower, angle);

                    }

                    // FromAxisAngle seems to rotate the opposite of the
                    // expected angle for URDF, so negate it here
                    const delta = new THREE.Quaternion().setFromAxisAngle(this.axis, angle);
                    this.quaternion.multiplyQuaternions(this.origQuaternion, delta);

                    this.jointValue = angle;
                    this.matrixWorldNeedsUpdate = true;

                    break;
                }

                case 'prismatic': {

                    let angle = values[0];
                    if (angle == null) break;
                    if (angle === this.jointValue) break;

                    if (!this.ignoreLimits) {

                        angle = Math.min(this.limit.upper, angle);
                        angle = Math.max(this.limit.lower, angle);

                    }

                    this.position.copy(this.origPosition);
                    this.position.addScaledVector(this.axis, angle);

                    this.jointValue = angle;
                    this.worldMatrixNeedsUpdate = true;
                    break;

                }

                case 'floating':
                case 'planar':
                    // TODO: Support these joint types
                    console.warn(`'${ this.jointType }' joint not yet supported`);

            }

            return this.jointValue;

        }

    }

    /*
    Reference coordinate frames for THREE.js and ROS.
    Both coordinate systems are right handed so the URDF is instantiated without
    frame transforms. The resulting model can be rotated to rectify the proper up,
    right, and forward directions

    THREE.js
       Y
       |
       |
       .-----X
     ／
    Z

    ROS URDf
           Z
           |   X
           | ／
     Y-----.

    */

    const tempQuaternion = new THREE.Quaternion();
    const tempEuler = new THREE.Euler();

    /* URDFLoader Class */
    // Loads and reads a URDF file into a THREEjs Object3D format
    class URDFLoader {

        // Cached mesh loaders
        get STLLoader() {

            this._stlloader = this._stlloader || new STLLoader.STLLoader(this.manager);
            return this._stlloader;

        }

        get DAELoader() {

            this._daeloader = this._daeloader || new ColladaLoader.ColladaLoader(this.manager);
            return this._daeloader;

        }

        get TextureLoader() {

            this._textureloader = this._textureloader || new THREE.TextureLoader(this.manager);
            return this._textureloader;

        }

        constructor(manager) {

            this.manager = manager || THREE.DefaultLoadingManager;

        }

        /* Utilities */
        // forEach and filter function wrappers because
        // HTMLCollection does not the by default
        forEach(coll, func) {

            return [].forEach.call(coll, func);

        }
        filter(coll, func) {

            return [].filter.call(coll, func);

        }

        // take a vector "x y z" and process it into
        // an array [x, y, z]
        _processTuple(val) {

            if (!val) return [0, 0, 0];
            return val.trim().split(/\s+/g).map(num => parseFloat(num));

        }

        // applies a rotation a threejs object in URDF order
        _applyRotation(obj, rpy, additive = false) {

            // if additive is true the rotation is applied in
            // addition to the existing rotation
            if (!additive) obj.rotation.set(0, 0, 0);

            tempEuler.set(rpy[0], rpy[1], rpy[2], 'ZYX');
            tempQuaternion.setFromEuler(tempEuler);
            tempQuaternion.multiply(obj.quaternion);
            obj.quaternion.copy(tempQuaternion);

        }

        /* Public API */
        // urdf:    The path to the URDF within the package OR absolute
        // packages:     The equivelant of a (list of) ROS package(s):// directory
        // onComplete:      Callback that is passed the model once loaded
        load(urdf, packages, onComplete, options) {

            // Check if a full URI is specified before
            // prepending the package info
            const defaultOptions = {
                workingPath: THREE.LoaderUtils.extractUrlBase(urdf),
                linkType: 'visual',
            };
            const urdfPath = this.manager.resolveURL(urdf);

            options = Object.assign(defaultOptions, options);

            fetch(urdfPath, options.fetchOptions)
                .then(res => res.text())
                .then(data => this.parse(data, packages, onComplete, options));

        }

        parse(content, packages, onComplete, options) {

            options = Object.assign({

                loadMeshCb: this.defaultMeshLoader.bind(this),
                workingPath: '',

            }, options);

            let result = null;
            let meshCount = 0;

            const createMeshTallyFunc = func => {

                return (...args) => {

                    func(...args);

                    meshCount--;
                    if (meshCount === 0) {

                        requestAnimationFrame(() => {
                            if (typeof onComplete === 'function') {
                                onComplete(result);
                            }
                        });

                    }
                };
            };

            const loadMeshFunc = (path, ext, done) => {

                meshCount++;
                options.loadMeshCb(path, ext, createMeshTallyFunc(done));

            };
            result = this._processUrdf(content, packages, options, loadMeshFunc);

            if (meshCount === 0 && typeof onComplete === 'function') {

                onComplete(result);
                onComplete = null;

            }

            return result;

        }

        // Default mesh loading function
        defaultMeshLoader(path, ext, done) {

            if (/\.stl$/i.test(path)) {

                this.STLLoader.load(path, geom => {
                    const mesh = new THREE.Mesh(geom, new THREE.MeshPhongMaterial());
                    done(mesh);
                });

            } else if (/\.dae$/i.test(path)) {

                this.DAELoader.load(path, dae => done(dae.scene));

            } else {

                console.warn(`URDFLoader: Could not load model at ${ path }.\nNo loader available`);

            }

        }

        /* Private Functions */

        // Resolves the path of mesh files
        _resolvePackagePath(pkg, meshPath, currPath) {

            if (!/^package:\/\//.test(meshPath)) {

                return currPath !== undefined ? currPath + meshPath : meshPath;

            }

            // Remove "package://" keyword and split meshPath at the first slash
            const [targetPkg, relPath] = meshPath.replace(/^package:\/\//, '').split(/\/(.+)/);

            if (typeof pkg === 'string') {

                // "pkg" is one single package
                if (pkg.endsWith(targetPkg)) {

                    // "pkg" is the target package
                    return pkg + '/' + relPath;

                } else {

                    // Assume "pkg" is the target package's parent directory
                    return pkg + '/' + targetPkg + '/' + relPath;

                }

            } else if (typeof pkg === 'object') {

                // "pkg" is a map of packages
                if (targetPkg in pkg) {

                    return pkg[targetPkg] + '/' + relPath;

                } else {

                    console.error(`URDFLoader : ${ targetPkg } not found in provided package list!`);
                    return null;

                }
            }
        }

        // Process the URDF text format
        _processUrdf(data, packages, options, loadMeshCb) {
            const parser = new DOMParser();
            const urdf = parser.parseFromString(data, 'text/xml');

            const robottag = this.filter(urdf.children, c => c.nodeName === 'robot').pop();
            return this._processRobot(robottag, packages, options, loadMeshCb);

        }

        // Process the <robot> node
        _processRobot(robot, packages, options, loadMeshCb) {
            const {
                workingPath: path,
                linkType,
            } = options;
            const materials = robot.querySelectorAll('material');
            const links = [];
            const joints = [];
            const obj = new URDFRobot();
            obj.name = robot.getAttribute('name');

            // Process the <joint> and <link> nodes
            this.forEach(robot.children, n => {

                const type = n.nodeName.toLowerCase();
                if (type === 'link') links.push(n);
                else if (type === 'joint') joints.push(n);

            });

            // Create the <material> map
            const materialMap = {};
            this.forEach(materials, m => {

                const name = m.getAttribute('name');
                if (!materialMap[name]) {

                    materialMap[name] = {};
                    this.forEach(m.children, c => {

                        this._processMaterial(
                            materialMap[name],
                            c,
                            packages,
                            path
                        );

                    });

                }

            });

            // Create the <link> map
            const linkMap = {};
            this.forEach(links, l => {

                const name = l.getAttribute('name');
                linkMap[name] = this._processLink(l, materialMap, packages, path, linkType, loadMeshCb);

            });

            // Create the <joint> map
            const jointMap = {};
            this.forEach(joints, j => {

                const name = j.getAttribute('name');
                jointMap[name] = this._processJoint(j, linkMap);

            });

            for (const key in linkMap) {

                if (linkMap[key].parent == null) {

                    obj.add(linkMap[key]);

                }

            }

            obj.joints = jointMap;
            obj.links = linkMap;

            return obj;

        }

        // Process joint nodes and parent them
        _processJoint(joint, linkMap) {

            const jointType = joint.getAttribute('type');
            const obj = new URDFJoint();
            obj.urdfNode = joint;
            obj.name = joint.getAttribute('name');
            obj.jointType = jointType;

            let parent = null;
            let child = null;
            let xyz = [0, 0, 0];
            let rpy = [0, 0, 0];

            // Extract the attributes
            this.forEach(joint.children, n => {

                const type = n.nodeName.toLowerCase();
                if (type === 'origin') {

                    xyz = this._processTuple(n.getAttribute('xyz'));
                    rpy = this._processTuple(n.getAttribute('rpy'));

                } else if (type === 'child') {

                    child = linkMap[n.getAttribute('link')];

                } else if (type === 'parent') {

                    parent = linkMap[n.getAttribute('link')];

                } else if (type === 'limit') {

                    obj.limit.lower = parseFloat(n.getAttribute('lower') || obj.limit.lower);
                    obj.limit.upper = parseFloat(n.getAttribute('upper') || obj.limit.upper);

                }

            });

            // Join the links
            parent.add(obj);
            obj.add(child);
            this._applyRotation(obj, rpy);
            obj.position.set(xyz[0], xyz[1], xyz[2]);

            // Set up the rotate function
            const axisnode = this.filter(joint.children, n => n.nodeName.toLowerCase() === 'axis')[0];

            if (axisnode) {

                const axisxyz = axisnode.getAttribute('xyz').split(/\s+/g).map(num => parseFloat(num));
                obj.axis = new THREE.Vector3(axisxyz[0], axisxyz[1], axisxyz[2]);
                obj.axis.normalize();

            }

            return obj;

        }

        // Process the <link> nodes
        _processLink(link, materialMap, packages, path, linkType, loadMeshCb) {

            const visualNodes = this.filter(link.children, n => n.nodeName.toLowerCase() === linkType);
            const obj = new URDFLink();
            obj.name = link.getAttribute('name');
            obj.urdfNode = link;

            this.forEach(visualNodes, vn => this._processVisualNode(vn, obj, materialMap, packages, path, loadMeshCb));

            return obj;

        }

        _processMaterial(material, node, packages, path) {

            const type = node.nodeName.toLowerCase();
            if (type === 'color') {

                const rgba =
                    node
                        .getAttribute('rgba')
                        .split(/\s/g)
                        .map(v => parseFloat(v));

                this._copyMaterialAttributes(
                    material,
                    {
                        color: new THREE.Color(rgba[0], rgba[1], rgba[2]),
                        opacity: rgba[3],
                        transparent: rgba[3] < 1,
                    });

            } else if (type === 'texture') {

                const filename = node.getAttribute('filename');
                const filePath = this._resolvePackagePath(packages, filename, path);
                this._copyMaterialAttributes(
                    material,
                    {
                        map: this.TextureLoader.load(filePath),
                    });

            }
        }

        _copyMaterialAttributes(material, materialAttributes) {

            if ('color' in materialAttributes) {

                material.color = materialAttributes.color.clone();
                material.opacity = materialAttributes.opacity;
                material.transparent = materialAttributes.transparent;

            }

            if ('map' in materialAttributes) {

                material.map = materialAttributes.map.clone();

            }

        }

        // Process the visual nodes into meshes
        _processVisualNode(vn, linkObj, materialMap, packages, path, loadMeshCb) {

            let xyz = [0, 0, 0];
            let rpy = [0, 0, 0];
            let scale = [1, 1, 1];

            const material = new THREE.MeshPhongMaterial();
            let primitiveModel = null;
            this.forEach(vn.children, n => {

                const type = n.nodeName.toLowerCase();
                if (type === 'geometry') {

                    const geoType = n.children[0].nodeName.toLowerCase();
                    if (geoType === 'mesh') {

                        const filename = n.children[0].getAttribute('filename');
                        const filePath = this._resolvePackagePath(packages, filename, path);

                        // file path is null if a package directory is not provided.
                        if (filePath !== null) {

                            const ext = filePath.match(/.*\.([A-Z0-9]+)$/i).pop() || '';
                            const scaleAttr = n.children[0].getAttribute('scale');
                            if (scaleAttr) scale = this._processTuple(scaleAttr);

                            loadMeshCb(filePath, ext, (obj, err) => {

                                if (err) {

                                    console.error('URDFLoader: Error loading mesh.', err);

                                } else if (obj) {

                                    if (obj instanceof THREE.Mesh) {

                                        obj.material.copy(material);

                                    }

                                    linkObj.add(obj);

                                    obj.position.set(xyz[0], xyz[1], xyz[2]);
                                    obj.rotation.set(0, 0, 0);

                                    // multiply the existing scale by the scale components because
                                    // the loaded model could have important scale values already applied
                                    // to the root. Collada files, for example, can load in with a scale
                                    // to convert the model units to meters.
                                    obj.scale.x *= scale[0];
                                    obj.scale.y *= scale[1];
                                    obj.scale.z *= scale[2];

                                    this._applyRotation(obj, rpy);

                                }

                            });

                        }

                    } else if (geoType === 'box') {

                        primitiveModel = new THREE.Mesh();
                        primitiveModel.geometry = new THREE.BoxBufferGeometry(1, 1, 1);
                        primitiveModel.material = material;

                        const size = this._processTuple(n.children[0].getAttribute('size'));

                        linkObj.add(primitiveModel);
                        primitiveModel.scale.set(size[0], size[1], size[2]);

                    } else if (geoType === 'sphere') {

                        primitiveModel = new THREE.Mesh();
                        primitiveModel.geometry = new THREE.SphereBufferGeometry(1, 30, 30);
                        primitiveModel.material = material;

                        const radius = parseFloat(n.children[0].getAttribute('radius')) || 0;
                        primitiveModel.scale.set(radius, radius, radius);

                        linkObj.add(primitiveModel);

                    } else if (geoType === 'cylinder') {

                        primitiveModel = new THREE.Mesh();
                        primitiveModel.geometry = new THREE.CylinderBufferGeometry(1, 1, 1, 30);
                        primitiveModel.material = material;

                        const radius = parseFloat(n.children[0].getAttribute('radius')) || 0;
                        const length = parseFloat(n.children[0].getAttribute('length')) || 0;
                        primitiveModel.scale.set(radius, length, radius);
                        primitiveModel.rotation.set(Math.PI / 2, 0, 0);

                        linkObj.add(primitiveModel);

                    }

                } else if (type === 'origin') {

                    xyz = this._processTuple(n.getAttribute('xyz'));
                    rpy = this._processTuple(n.getAttribute('rpy'));

                } else if (type === 'material') {

                    const materialName = n.getAttribute('name');
                    if (materialName) {

                        this._copyMaterialAttributes(material, materialMap[materialName]);

                    } else {

                        this.forEach(n.children, c => {

                            this._processMaterial(material, c, packages, path);

                        });

                    }

                }
            });

            // apply the position and rotation to the primitive geometry after
            // the fact because it's guaranteed to have been scraped from the child
            // nodes by this point
            if (primitiveModel) {

                this._applyRotation(primitiveModel, rpy, true);
                primitiveModel.position.set(xyz[0], xyz[1], xyz[2]);

            }

        }

    }

    return URDFLoader;

})));
//# sourceMappingURL=URDFLoader.js.map
