//jshint esversion:6
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const ejs = require("ejs");
const mongoose = require("mongoose");
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth2").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set("view engine", "ejs");

app.use(session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
//used a  local host

mongoose.connect("mongodb://localhost:27017/userDB");

const userSchema = new mongoose.Schema({
    email: String,
    password: String,
    googleId: String,
    username: String, // Make username optional
    secret: String
});

userSchema.plugin(passportLocalMongoose);
userSchema.plugin(findOrCreate);

const User = mongoose.model("User", userSchema);

passport.use(User.createStrategy());

passport.serializeUser(function(user, done) {
    done(null, user.id);
});

passport.deserializeUser(async function(id, done) {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/secrets",
    passReqToCallback: true,
    userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
  },
  async function(request, accessToken, refreshToken, profile, done) {
    try {
      let user = await User.findOne({ googleId: profile.id });

      if (!user) {
        user = new User({
          googleId: profile.id,
          username: profile.emails[0].value, // Ensure username is unique or handle it appropriately
          email: profile.emails[0].value
        });
        await user.save();
      }

      done(null, user);
    } catch (err) {
      done(err, null);
    }
  }
));

app.get("/", function(req, res) {
    res.render("home");
});

app.get("/login", function(req, res) {
    res.render("login");
});

app.get("/register", function(req, res) {
    res.render("register");
});

app.get("/auth/google",
    passport.authenticate('google', { scope: ["profile", "email"] })
);

app.get('/auth/google/secrets',
    passport.authenticate('google', {
        successRedirect: '/secrets',
        failureRedirect: '/login'
    })
);

app.get("/secrets", function(req, res) {
    User.find({"secret" :{$ne: null}}).then(result =>{
        res.render("secrets", {usersWithSecrets: result});
        }).catch(err =>{
            console.log(err);
    });

});

app.get("/logout", function(req, res) {
    req.logout(function(err) {
        if (err) {
            return next(err);
        }
        res.redirect('/');
    });
});

app.get("/submit", function(req,res){
    if (req.isAuthenticated()) {
        res.render("submit");
    } else {
        res.redirect("/login");
    }
})

app.post("/submit",function(req,res){
    const submittedSecret = req.body.secret;
        User.findById(req.user.id).then(result=>{
            result.secret = submittedSecret;
            result.save();

            res.redirect("/secrets");

        });

});

app.post("/register", function(req, res) {
    User.register({ username: req.body.username }, req.body.password, function(err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});

app.post("/login", function(req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });

    req.login(user, function(err) {
        if (err) {
            console.log(err);
        } else {
            passport.authenticate("local")(req, res, function() {
                res.redirect("/secrets");
            });
        }
    });
});

app.listen(3000, function() {
    console.log("Server started on port 3000");
});
