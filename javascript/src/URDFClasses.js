import { Object3D, Quaternion } from 'three';

class URDFRobot extends Object3D {

    constructor(...args) {

        super(...args);
        this.isURDFRobot = true;
        this.type = 'URDFRobot';
        this.urdfNode = null;

        this.links = null;
        this.joints = null;

    }

    clone( recursive ) {

        return new URDFRobot().copy( this, recursive );

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

class URDFLink extends Object3D {

    constructor(...args) {

        super(...args);
        this.isURDFLink = true;
        this.type = 'URDFLink';
        this.urdfNode = null;

    }

    clone( recursive ) {

        return new URDFLink().copy( this, recursive );

    }

    copy(source, recursive) {

        super.copy(source, recursive);
        this.urdfNode = source.urdfNode;

        return this;

    }

}

class URDFJoint extends Object3D {

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
    clone( recursive ) {

        return new URDFJoint().copy( this, recursive );

    }

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
                const delta = new Quaternion().setFromAxisAngle(this.axis, angle);
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

export { URDFRobot, URDFLink, URDFJoint };
