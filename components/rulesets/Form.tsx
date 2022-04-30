import React from "react";
import { Form, FormProps as BaseFormProps } from "react-final-form";
import { TextField } from "mui-rff";
import Button from "@material-ui/core/Button";
import Box from "@material-ui/core/Box";

import { ExposedRuleset } from "../../lib/rulesets";

export type FormProps = BaseFormProps<ExposedRuleset> & {
  onDelete?: () => void;
};

export default function RulesetForm({ onDelete, ...rest }: FormProps) {
  const isNew = rest.initialValues?.id === undefined;
  return (
    <Form
      {...rest}
      render={({ handleSubmit, form, submitting }) => (
        <form onSubmit={handleSubmit}>
          <Box pb={2}>
            <TextField
              label="Name"
              name="name"
              required={true}
              variant="filled"
            />
          </Box>
          <Box pb={2}>
            <Button
              type="submit"
              disabled={submitting}
              variant="contained"
              color="primary"
            >
              {isNew ? "Create" : "Update"}
            </Button>
            {!isNew && (
              <>
                {" "}
                <Button variant="contained" onClick={onDelete}>
                  Delete
                </Button>
              </>
            )}
          </Box>
        </form>
      )}
    />
  );
}
