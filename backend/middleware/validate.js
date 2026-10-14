import { z } from "zod";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source] ?? {});
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue.path.join(".") || source;
      return res.status(400).json({
        success: false,
        message: `${where}: ${issue.message}`,
        errors: z.flattenError(result.error)
      });
    }
    req[source] = result.data;
    next();
  };
}
