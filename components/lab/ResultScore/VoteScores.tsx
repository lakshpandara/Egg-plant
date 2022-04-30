import React from "react";
import { Button, Paper } from "@material-ui/core";
import { makeStyles } from "@material-ui/core/styles";
import { grey } from "@material-ui/core/colors";
import { scaleLinear } from "d3-scale";
import { apiRequest } from "../../../lib/api";
import { ExposedVote } from "../../../lib/judgements";
import { useLabContext } from "../../../utils/react/hooks/useLabContext";

const colorScale = scaleLinear<string, string>()
  .domain([0, 1, 2, 3])
  .range(["#FF6A6B", "#FFAB61", "#CCD766", "#91D16F"]);

const useStyles = makeStyles(() => ({
  paper: {
    padding: "15px",
    position: "relative",
    left: "14px",
    border: "1px solid #ebebeb",
    boxShadow: "0px 10px 10px rgba(0, 0, 0, 0.1)",
  },
  paperArrow: {
    height: "16px",
    width: "16px",
    backgroundColor: "#fff",
    position: "absolute",
    left: 0,
    top: "50%",
    borderBottom: "1px solid #ebebeb",
    borderLeft: "1px solid #ebebeb",
    transform: "translate(-50%, -50%) rotate(45deg)",
  },
  button: {
    marginRight: "5px",
    borderRadius: "50px",
    fontSize: "15px",
    fontWeight: 400,
    padding: "5px 12px",
    color: "white",
    textTransform: "none",
    "&:last-of-type": {
      marginRight: "0px",
    },
  },
}));

type Props = {
  vote?: ExposedVote;
  phrase: string;
  documentId: number;
  onChange: (state: string) => void;
};

const BUTTONS = ["0 - Poor", "1 - Fair", "2 - Good", "3 - Perfect"];

export const VoteScores = ({ vote, phrase, documentId, onChange }: Props) => {
  const classes = useStyles();
  const { searchConfiguration } = useLabContext();

  const handleUpdateVote = async (score: number) => {
    onChange("changing");

    await apiRequest("/api/lab/vote/updateOrCreate", {
      voteId: vote?.id,
      score,
      searchConfigurationId: searchConfiguration?.id,
      documentId,
      phrase,
    });

    onChange("changed");
  };

  const handleDeleteVote = async () => {
    onChange("changing");

    await apiRequest("/api/lab/vote/delete", {
      voteId: vote?.id,
      phrase,
      searchConfigurationId: searchConfiguration?.id,
    });

    onChange("changed");
  };

  return (
    <Paper className={classes.paper}>
      <div className={classes.paperArrow} />
      {BUTTONS.map((button, index) => (
        <Button
          key={`${button}-${index}`}
          className={classes.button}
          style={{ background: colorScale(index) }}
          onClick={() => handleUpdateVote(index)}
        >
          {button}
        </Button>
      ))}
      {vote && (
        <Button
          className={classes.button}
          style={{ background: grey[500] }}
          onClick={() => handleDeleteVote()}
        >
          Clear
        </Button>
      )}
    </Paper>
  );
};
