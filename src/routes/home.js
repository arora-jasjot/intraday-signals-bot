const express = require("express");
const HomeController = require("../controllers/HomeController");

const router = express.Router();
const homeController = new HomeController();

router.get("/", homeController.sendHelloMessage.bind(homeController));

module.exports = router;
