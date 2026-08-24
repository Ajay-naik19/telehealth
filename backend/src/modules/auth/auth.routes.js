const express = require("express");
const router = express.Router();
const authController = require("./auth.controller");
const { signupSchema, loginSchema } = require("./auth.schema");
const { validate } = require("../../middleware/validation");

const routeAliases = {
  patientSignup: "/api/auth/patient/signup",
  patientLogin: "/api/auth/patient/login",
  doctorSignup: "/api/auth/doctor/signup",
  doctorLogin: "/api/auth/doctor/login",
  logout: "/api/auth/logout",
  refreshToken: "/api/auth/refresh-token",
  session: "/api/auth/session",
};

router.post(
  routeAliases.patientSignup,
  validate(signupSchema),
  authController.userSignup,
);
router.post(
  routeAliases.patientLogin,
  validate(loginSchema),
  authController.userLogin,
);
router.post(
  routeAliases.doctorSignup,
  validate(signupSchema),
  authController.docSignup,
);
router.post(
  routeAliases.doctorLogin,
  validate(loginSchema),
  authController.docLogin,
);
router.get(routeAliases.logout, authController.logout);
router.post(routeAliases.refreshToken, authController.refreshToken);
router.get(routeAliases.session, authController.getSession);

module.exports = router;
