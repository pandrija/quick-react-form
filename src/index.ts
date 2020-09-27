import * as React from "react";
import { useReducer } from "react";

// https://stackoverflow.com/questions/25025102/angularjs-difference-between-pristine-dirty-and-touched-untouched

export type ValidatorFunction = (value: any) => boolean;

export type Validator = "required" | RegExp | ValidatorFunction;

// TODO Async run only on blur?
//export type AsyncValidator = (value: any) => Promise<true | string>;

export type FieldDefinition = {
  defaultValue: any;
  validators?: Validator[];
  //asyncValidators?: AsyncValidator[];
};

type FormData = {
  [name: string]: any;
};

export type FormDefinition<T> = {
  fields: {
    [P in keyof T]: FieldDefinition;
  };
};

export type FormAction<T extends FormData> =
  | { type: "blur"; field: keyof T }
  | { type: "change"; field: keyof T; value: any }
  | { type: "submit" } // After submit!
  | { type: "reset" };

export type FieldState = {
  value: any;
  valid: boolean;
  pristine: boolean;
  dirty: boolean;
  invalid: boolean;
  untouched: boolean;
  touched: boolean;
};

export type FieldsState<T extends FormData> = { [P in keyof T]: FieldState };

export type FormState = {
  valid: boolean;
  pristine: boolean;
  dirty: boolean;
  invalid: boolean;
};

export type AttachToInputResult = {
  value: any;
  onChange: (
    event: React.ChangeEvent<{ name?: string; value: unknown }>
  ) => void;
  onBlur: React.FocusEventHandler<
    HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
  >;
};

function runValidators(fieldDefinition: FieldDefinition, value: any) {
  if (!fieldDefinition.validators) {
    return true;
  }
  // TODO Run all validators
  return fieldDefinition.validators.reduce((p, c) => {
    if (c === "required") {
      return p && !!value;
    } else if (typeof c === "function") {
      return p && c(value);
    } else {
      return p && !!(c as RegExp).exec(value);
    }
  }, true);
}

function getInitialFieldState(fieldDefinition: FieldDefinition): FieldState {
  const valid = runValidators(fieldDefinition, fieldDefinition.defaultValue);
  return {
    value: fieldDefinition.defaultValue,
    dirty: false,
    valid,
    invalid: !valid,
    pristine: true,
    touched: false,
    untouched: true,
  };
}

function getInitialFieldsState<T extends FormData>(
  formDefinition: FormDefinition<T>
): FieldsState<T> {
  const keys = Object.keys(formDefinition.fields);
  return keys.reduce(
    (o, key) => ({
      ...o,
      [key]: getInitialFieldState(formDefinition.fields[key]),
    }),
    {}
  ) as FieldsState<T>;
}

export function useForm<T extends FormData>(definition: FormDefinition<T>) {
  const keys = Object.keys(definition.fields);
  const initialFieldsState = getInitialFieldsState(definition);

  const reducer = (state: FieldsState<T>, action: FormAction<T>) => {
    switch (action.type) {
      case "change":
        const valid = runValidators(
          definition.fields[action.field],
          action.value
        );
        return {
          ...state,
          [action.field]: {
            ...state[action.field],
            value: action.value,
            valid,
            invalid: !valid,
            pristine: false,
            dirty: true,
          },
        };
      case "blur":
        return {
          ...state,
          [action.field]: {
            ...state[action.field],
            touched: true,
            untouched: false,
          },
        };
      case "submit":
        return keys.reduce(
          (o, key) => ({
            ...o,
            [key]: {
              ...state[key],
              dirty: false,
              pristine: true,
              touched: false,
              untouched: true,
            },
          }),
          {}
        ) as FieldsState<T>;
      case "reset":
        return getInitialFieldsState(definition);
    }
  };
  const getData = (fieldsState: FieldsState<T>) => {
    return keys.reduce(
      (o, key) => ({
        ...o,
        [key]: fieldsState[key].value,
      }),
      {}
    ) as T;
  };

  const getFormState = (fieldsState: FieldsState<T>): FormState => {
    return {
      valid: keys.reduce((v, key) => fieldsState[key].valid && v, true),
      pristine: keys.reduce((v, key) => fieldsState[key].pristine && v, true),
      dirty: keys.reduce((v, key) => fieldsState[key].dirty || v, false),
      invalid: keys.reduce((i, key) => fieldsState[key].invalid || i, false),
    };
  };

  const attachToInput = (fieldName: keyof T): AttachToInputResult => {
    return {
      value: state[fieldName].value,
      onChange: (e) =>
        dispatch({ field: fieldName, type: "change", value: e.target.value }),
      onBlur: () => dispatch({ field: fieldName, type: "blur" }),
    };
  };

  const [state, dispatch] = useReducer(reducer, initialFieldsState);
  return {
    fields: state,
    form: getFormState(state),
    data: getData(state),
    dispatch,
    attachToInput,
  };
}
