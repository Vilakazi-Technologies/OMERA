import { expect, it } from "vitest";
import {
  activeQuestion,
  answerQuestion,
  editAnswer,
  skipQuestion,
  type QuestionFlow,
} from "@/lib/forms/questions";

function flow(): QuestionFlow {
  return {
    languageId: "zul",
    currentIndex: 0,
    fields: [
      { id: "full_name", label: "Igama", prompt: "Ngubani igama lakho?", required: true },
      { id: "employer", label: "Umqashi", prompt: "Usebenzaphi?", required: false },
      { id: "city", label: "Idolobha", prompt: "Uhlalaphi?", required: false },
    ],
  };
}

it("one_active_question_is_returned", () => {
  let state = flow();
  // Translated prompts stay on screen while identity stays canonical.
  expect(activeQuestion(state)).toMatchObject({
    index: 0,
    total: 3,
    languageId: "zul",
    field: { id: "full_name", prompt: "Ngubani igama lakho?" },
  });
  state = answerQuestion(state, "  Ṱhendo Muḓau  ");
  expect(state.fields[0].value).toBe("Ṱhendo Muḓau");
  expect(activeQuestion(state)?.field.id).toBe("employer");
  state = answerQuestion(state, "VILATECH");
  state = answerQuestion(state, "Thohoyandou");
  expect(activeQuestion(state)).toBeNull();
});

it("a_skipped_optional_field_stays_blank", () => {
  let state = answerQuestion(flow(), "Ṱhendo");
  state = skipQuestion(state);
  expect(state.fields[1].value).toBeUndefined();
  expect(activeQuestion(state)?.field.id).toBe("city");
  expect(() => skipQuestion({ ...flow(), currentIndex: 0 })).toThrow(
    "SKIP_REQUIRED_FIELD",
  );
});

it("an_edited_earlier_answer_keeps_later_answers", () => {
  let state = flow();
  state = answerQuestion(state, "Ṱhendo");
  state = answerQuestion(state, "VILATECH");
  state = answerQuestion(state, "Thohoyandou");
  state = editAnswer(state, 0, "Thendo M");
  expect(state.fields[0].value).toBe("Thendo M");
  expect(state.fields[1].value).toBe("VILATECH");
  expect(state.fields[2].value).toBe("Thohoyandou");
});
