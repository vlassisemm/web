import * as many2OneField from "@web/views/fields/many2one/many2one_field";
import * as many2one from "@web/views/fields/many2one/many2one";
import {Many2One, many2OneProps} from "@web/views/fields/many2one/many2one";
import {
    Many2XAutocomplete,
    many2XAutocompleteProps,
    useSelectCreate,
} from "@web/views/fields/relational_utils";
import {
    many2ManyTagsField,
    many2ManyTagsFieldProps,
} from "@web/views/fields/many2many_tags/many2many_tags_field";
import {FormController} from "@web/views/form/form_controller";
import {Many2OneReferenceField} from "@web/views/fields/many2one_reference/many2one_reference_field";
import {evaluateBooleanExpr} from "@web/core/py_js/py";
import {fieldColorProps} from "../views/fields/standard_field_props.esm";
import {isX2Many} from "@web/views/utils";
import {patch} from "@web/core/utils/patch";
import {registry} from "@web/core/registry";
import {session} from "@web/session";
import {t} from "@odoo/owl";

patch(many2XAutocompleteProps, fieldColorProps);
patch(many2OneProps, {
    ...fieldColorProps,
    searchLimit: t.number().optional(),
    m2xOptions: t.object().optional(),
});
patch(many2ManyTagsFieldProps, {
    ...fieldColorProps,
    searchLimit: t.number().optional(),
});

function evaluateSystemParameterDefaultTrue(option) {
    const isOptionSet = session.web_m2x_options?.[`web_m2x_options.${option}`];
    return isOptionSet ? evaluateBooleanExpr(isOptionSet) : true;
}
function evaluateSystemParameterNumber(option) {
    const isOptionSet = session.web_m2x_options?.[`web_m2x_options.${option}`];
    return isOptionSet ? Number(isOptionSet) : false;
}

function evaluateCreateOption(props, attrs, options, option, noOption) {
    if (props.canCreate === false || options.no_create || options[noOption]) {
        return false;
    }
    const canCreate = attrs.can_create ? evaluateBooleanExpr(attrs.can_create) : true;
    if (noOption in options) {
        return canCreate;
    }
    if (option in options) {
        const value = options[option];
        // Domain-valued create options belong to core; do not parse them as Python.
        return (
            canCreate &&
            (typeof value === "string"
                ? evaluateBooleanExpr(value)
                : typeof value === "boolean"
                  ? value
                  : true)
        );
    }
    return canCreate && evaluateSystemParameterDefaultTrue(option);
}

export function m2o_options_props_create(props, attrs, options) {
    props.canQuickCreate = evaluateCreateOption(
        props,
        attrs,
        options,
        "create",
        "no_quick_create"
    );
    return props;
}

export function m2o_options_props_create_edit(props, attrs, options) {
    props.canCreateEdit = evaluateCreateOption(
        props,
        attrs,
        options,
        "create_edit",
        "no_create_edit"
    );
    return props;
}

export function m2o_options_props_limit(props, attrs, options) {
    const ir_options = session.web_m2x_options || {};
    if (Number(options.limit)) {
        props.searchLimit = Number(options.limit);
    } else if (Number(ir_options["web_m2x_options.limit"])) {
        props.searchLimit = Number(ir_options["web_m2x_options.limit"]);
    }
    return props;
}

export function m2o_options_props_open(props, attrs, options) {
    if (!("no_open" in options)) {
        props.canOpen = evaluateSystemParameterDefaultTrue("open");
    }
    return props;
}

export function m2o_options_props(props, attrs, options) {
    let newProps = props;
    newProps = m2o_options_props_create(newProps, attrs, options);
    newProps = m2o_options_props_create_edit(newProps, attrs, options);
    newProps = m2o_options_props_limit(newProps, attrs, options);
    newProps = m2o_options_props_open(newProps, attrs, options);
    newProps.m2xOptions = options;
    newProps.fieldColor = options.field_color;
    newProps.fieldColorOptions = options.colors;
    return newProps;
}

const oldBuildM2OFieldDescription = many2OneField.buildM2OFieldDescription;
many2OneField.buildM2OFieldDescription = (component) => {
    const _super = oldBuildM2OFieldDescription(component);
    return {
        ..._super,
        extractProps(staticInfo, dynamicInfo) {
            const props = many2OneField.extractM2OFieldProps(staticInfo, dynamicInfo);
            return m2o_options_props(props, staticInfo.attrs, staticInfo.options);
        },
    };
};

const oldcomputeM2OProps = many2one.computeM2OProps;
many2one.computeM2OProps = (fieldProps) => {
    const _super = oldcomputeM2OProps(fieldProps);
    return {
        ..._super,
        searchLimit: fieldProps.searchLimit,
        fieldColor: fieldProps.fieldColor,
        fieldColorOptions: fieldProps.fieldColorOptions,
        m2xOptions: fieldProps.m2xOptions,
    };
};

// FIXME: Many2OneReferenceField does not support m2o_options_props.
// This no-op prevents crashes, but proper option support is still missing.
// See roadmap note in PR #3191
patch(Many2OneReferenceField, {
    // eslint-disable-next-line no-unused-vars
    m2o_options_props(props, attrs, options) {
        return props;
    },
});

patch(many2OneField.Many2OneField.prototype, {
    get m2oProps() {
        const props = super.m2oProps;
        props.searchLimit = this.props.searchLimit;
        props.fieldColor = this.props.fieldColor;
        props.fieldColorOptions = this.props.fieldColorOptions;
        props.m2xOptions = this.props.m2xOptions;
        return props;
    },
});

patch(Many2One.prototype, {
    // Enforce the create/create_edit/open system parameters here, on the shared
    // Many2One component, rather than only in the many2one field's extractProps.
    // Specialized widgets (e.g. sol_product_many2one on sale/purchase order lines)
    // define their own extractProps and never call m2o_options_props, so a
    // field-level override does not reach them. They all render this component,
    // so gating it here covers every many2one.
    get activeActions() {
        const actions = super.activeActions;
        if (
            !this.props.m2xOptions &&
            !evaluateSystemParameterDefaultTrue("create_edit")
        ) {
            actions.createEdit = false;
        }
        return actions;
    },
    get hasLinkButton() {
        if (!this.props.m2xOptions && !evaluateSystemParameterDefaultTrue("open")) {
            return false;
        }
        return super.hasLinkButton;
    },
    get many2XAutocompleteProps() {
        let search_limit = 0;
        if (this.props.searchLimit) {
            search_limit = this.props.searchLimit;
        } else {
            search_limit = evaluateSystemParameterNumber("limit");
        }
        const field_color = this.props.fieldColor;
        const field_color_options = this.props.fieldColorOptions;
        const props = super.many2XAutocompleteProps;
        const ret_props = {...props};
        if (Number(search_limit) && Number(search_limit) > 1) {
            ret_props.searchLimit = search_limit - 1;
        }
        if (field_color && field_color_options) {
            ret_props.fieldColor = field_color;
            ret_props.fieldColorOptions = field_color_options;
        }
        if (!this.props.m2xOptions && !evaluateSystemParameterDefaultTrue("create")) {
            ret_props.quickCreate = null;
        }
        return ret_props;
    },
});

patch(many2ManyTagsField, {
    m2m_options_props_create(props, attrs, options) {
        props.canQuickCreate = evaluateCreateOption(
            props,
            attrs,
            options,
            "create",
            "no_quick_create"
        );
        return props;
    },
    m2m_options_props_create_edit(props, attrs, options) {
        props.canCreateEdit = evaluateCreateOption(
            props,
            attrs,
            options,
            "create_edit",
            "no_create_edit"
        );
        return props;
    },

    m2m_options_props_limit(props, attrs, options) {
        const ir_options = session.web_m2x_options || {};
        if (Number(options.limit) && options.limit > 1) {
            props.searchLimit = Number(options.limit) - 1;
        } else if (
            Number(ir_options["web_m2x_options.limit"]) &&
            ir_options["web_m2x_options.limit"] > 1
        ) {
            props.searchLimit = Number(ir_options["web_m2x_options.limit"]) - 1;
        }
        return props;
    },

    m2m_options_props(props, attrs, options) {
        let newProps = props;
        newProps = this.m2m_options_props_create(newProps, attrs, options);
        newProps = this.m2m_options_props_create_edit(newProps, attrs, options);
        newProps = this.m2m_options_props_limit(newProps, attrs, options);
        newProps.fieldColor = options.field_color;
        newProps.fieldColorOptions = options.colors;
        return newProps;
    },
    extractProps({attrs, options, string}, dynamicInfo) {
        const props = super.extractProps({attrs, options, string}, dynamicInfo);
        return this.m2m_options_props(props, attrs, options);
    },
});

patch(Many2XAutocomplete.prototype, {
    setup() {
        super.setup(...arguments);
        // Search More opens a form to create records, so it follows create_edit.
        // Keep quick creation independent of the selection dialog permission.
        const component = this;
        const activeActions = {
            ...this.props.activeActions,
            get create() {
                const actions = component.props.activeActions;
                return actions.create && actions.createEdit !== false;
            },
        };
        this.selectCreate = useSelectCreate({
            resModel: this.props.resModel,
            activeActions,
            onSelected: (resId) => {
                const ids = Array.isArray(resId) ? resId : [resId];
                return this.props.update(ids.map((id) => ({id})));
            },
            onCreateEdit: ({context}) => this.openMany2X({context}),
            onUnselect: this.props.isToMany ? undefined : () => this.props.update(),
        });
    },
    async loadOptionsSource(request) {
        var options = await super.loadOptionsSource(request);
        this.field_color = this.props.fieldColor;
        this.colors = this.props.fieldColorOptions;
        if (this.colors && this.field_color) {
            const recordId = (option) => option.data?.record?.id;
            var value_ids = options.map(recordId).filter(Boolean);
            const objects = await this.orm.call(
                this.props.resModel,
                "search_read",
                [],
                {
                    domain: [["id", "in", value_ids]],
                    fields: [this.field_color],
                }
            );
            for (var index in objects) {
                for (var index_value in options) {
                    if (recordId(options[index_value]) === objects[index].id) {
                        // Find value in values by comparing ids
                        var option = options[index_value];
                        // Find color with field value as key
                        var color =
                            this.colors[objects[index][this.field_color]] || "black";
                        option.style = "color:" + color;
                        break;
                    }
                }
            }
        }
        return options;
    },
});

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        const load = this.model.load.bind(this.model);
        this.model.load = (...args) => {
            this._setSubViewLimit();
            return load(...args);
        };
    },
    _setSubViewLimit() {
        const limit = Number(
            session.web_m2x_options?.["web_m2x_options.field_limit_entries"]
        );
        if (!Number.isInteger(limit) || limit <= 0) {
            return;
        }
        for (const field of Object.values(this.archInfo.fieldNodes)) {
            if (!isX2Many(this.props.fields[field.name]) || !field.field.useSubView) {
                continue;
            }
            const view = field.views?.[field.viewMode];
            if (view) {
                view.limit = limit;
            }
            const activeField = this.model.config.activeFields?.[field.name];
            if (activeField) {
                activeField.limit = limit;
            }
        }
    },
});

// O.W.L. v18+: schema is validated in dev mode on adding to registry
patch(registry.category("fields").validationSchema, {
    m2o_options_props_create: {type: Function, optional: true},
    m2o_options_props_create_edit: {type: Function, optional: true},
    m2o_options_props_limit: {type: Function, optional: true},
    m2o_options_props_open: {type: Function, optional: true},
    m2o_options_props: {type: Function, optional: true},
    m2m_options_props_create: {type: Function, optional: true},
    m2m_options_props_create_edit: {type: Function, optional: true},
    m2m_options_props_limit: {type: Function, optional: true},
    m2m_options_props: {type: Function, optional: true},
});

registry.category("fields").add(
    "many2one",
    {
        ...many2OneField.buildM2OFieldDescription(many2OneField.Many2OneField),
        extractProps(staticInfo, dynamicInfo) {
            const props = many2OneField.extractM2OFieldProps(staticInfo, dynamicInfo);
            return m2o_options_props(props, staticInfo.attrs, staticInfo.options);
        },
    },
    {force: true}
);
