/**
 * validate(schema) — returns Express middleware that validates req.body
 * against a Joi schema. On failure, passes a structured error to next().
 * On success, calls next() to continue the chain.
 */

const validate = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body, { abortEarly: false })

  if (error) {
    const details = error.details.map((d) => ({
      field: d.path.join('.'),
      message: d.message,
    }))
    return next({ statusCode: 400, isJoi: true, details })
  }

  next()
}

module.exports = validate
