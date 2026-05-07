export function prettyFactory() {
  return function formatLine(inputData: unknown) {
    if (typeof inputData === "string") {
      return inputData;
    }

    return JSON.stringify(inputData);
  };
}

export default {
  prettyFactory
};