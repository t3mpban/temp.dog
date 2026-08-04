import { ACH, achGoal, achValue, ready, textbox } from "./textbox.js";

const END = "free-the-end";

ready.then(function () {
  textbox(achValue(END) >= achGoal(ACH[END]) ? "ending" : "ending-locked");
});
