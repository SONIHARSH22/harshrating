import express from "express";
import bodyParser from "body-parser";
import pg from "pg";
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport";
import { Strategy } from "passport-local";
import env from "dotenv";
import GoogleStrategy from "passport-google-oauth2";
import cron from "node-cron";

const app = express();
const port = 3000;
const saltRounds = 10;
env.config();

// Set session expiration time to 30 minutes (adjust as needed)
const sessionExpirationTime = 30 * 60 * 1000; // 30 minutes in milliseconds

app.use(
  session({
    secret: "TOPSECRETWORD",
    resave: false,
    saveUninitialized: true,
    cookie: {
      maxAge: sessionExpirationTime,
    },
  })
);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static("public"));

app.use(passport.initialize());
app.use(passport.session());

// const db = new pg.Client({
//   user: "postgres",
//   host: "localhost",
//   database: "streetfood",
//   password: process.env.password,
//   port: 5432,
// });

let db;
if (process.env.NODE_ENV === "production") {
  // Use Render database configuration
  db = new pg.Client({
    connectionString: process.env.RENDER_POSTGRESQL_URL,
    ssl: {
      rejectUnauthorized: false,
    },
  });
} else {
  // Use local database configuration
  db = new pg.Client({
    user: "postgres",
    host: "localhost",
    database: "streetfood",
    password: process.env.password, // Set this environment variable locally
    port: 5432,
  });
}

db.connect((err) => {
  if (err) {
    console.error("Error connecting to database", err.stack);
    return;
  }
  console.log("Connected to database");
});

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("loginregister.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.post("/register", async (req, res) => {
  const email = req.body.username;
  const password = req.body.password;
  const phoneno = req.body.number;

  try {
    const checkResult = await db.query(
      "SELECT * FROM userloginregister WHERE emailid = $1",
      [email]
    );

    if (checkResult.rows.length > 0) {
      // res.send("Email already exists. Try logging in.");
      res.redirect("/login");
    } else {
      //hashing the password and saving it in the database
      bcrypt.hash(password, saltRounds, async (err, hash) => {
        if (err) {
          console.error("Error hashing password:", err);
        } else {
          console.log("Hashed Password:", hash);
          const result = await db.query(
            "INSERT INTO userloginregister (emailid,phonenumber,password) VALUES ($1, $2, $3) RETURNING *",
            [email, phoneno, hash]
          );
          console.log(result);

          const user = result.rows[0];
          console.log(result.rows[0]);

          req.login(user, (err) => {
            console.log(result);

            console.log("success");
            res.redirect("/mainpage");
          });
        }
      });
    }
  } catch (err) {
    console.log(err);
  }
});

app.get(
  "/auth/google",
  passport.authenticate("google", {
    scope: ["profile", "email"],
  })
);

app.get(
  "/auth/google/secrets",
  passport.authenticate("google", {
    successRedirect: "/mainpage",
    failureRedirect: "/login",
  })
);

app.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/mainpage",
    failureRedirect: "/login",
  })
);

app.get("/mainpage", async (req, res) => {
  console.log(req.user);

  if (req.isAuthenticated()) {
    try {
      const result = await db.query(
        `SELECT * FROM food1 ORDER BY overall_rating DESC;`
      );
      const i = result.rows;
      // console.log(i);
      //console.log(req.user);
      res.render("index.ejs", { street: i, username: req.user.name });
      // res.json(i);
    } catch (error) {
      console.error("Error executing query", error.stack);
      res.status(500).send("Internal Server Error");
    }
  } else {
    return res.redirect("/login");
  }
});



//getting all top rated by city name by area name by food/menu

app.get("/bycitybyareabyfood", async (req, res) => {
  try {
    const cityname = req.query.city;
    const cityfood = req.query.fooditem;
    const cityarea = req.query.area;
    const store = req.query.storename;

    console.log(cityname);
    console.log(cityfood);
    console.log(cityarea);
    console.log(store);

    //const queryString = `SELECT * FROM food WHERE city = '${cityname}' OR area = '${cityarea}' OR food_item = '${cityfood}' OR store_name = '${store}' ORDER BY overall_rating DESC;`;

    // const queryString = `SELECT * FROM food WHERE (city = '${cityname}' AND area = '${cityarea}') OR (city = '${cityname}' AND food_item = '${cityfood}') OR ( city = '${cityname}'AND store_name = '${store}') ORDER BY overall_rating DESC;`;

    let params = [cityname];

    let queryString = `SELECT * FROM food1 WHERE city = $1`;

    if (cityfood) {
      queryString += ` AND food_item = $${params.length + 1}`;
      params.push(cityfood);
    }

    if (cityarea) {
      queryString += ` AND area = $${params.length + 1}`;
      params.push(cityarea);
    }
    if (store) {
      queryString += ` AND store_name = $${params.length + 1}`;
      params.push(store);
    }

    queryString += ` ORDER BY overall_rating DESC`;

    //const result = await db.query(queryString);
    const result = await db.query(queryString, params);
    const i = result.rows;

    // Send response with the retrieved data
    res.render("index.ejs", { street: i, username: req.user.name });
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }
});

/////////////////////////////////////////////////////////////
app.get("/showdetial", async (req, res) => {
  const shop = req.query.id;

  try {
    const result = await db.query(`SELECT * FROM food1 where id = $1;`, [shop]);
    const givereviews = await db.query(
      `SELECT * FROM reviews1 WHERE shop_id = $1 ORDER BY created_at::date DESC, created_at DESC;`,
      [shop]
    );

    const i = result.rows;
    const gotfeedback = givereviews.rows;
    console.log(i);
    res.render("review.ejs", { street: i, feedback: gotfeedback });
    // res.json(i);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }

  //res.render("review.ejs",{id:shop});
});

// ??????????????????????????????????????????????
app.post("/addreviews", async (req, res) => {
  try {
    const review = req.body["review"];
    const storeid = req.body["storeid"];
    const username = req.user.name;
    const rate = req.body["rate"];
    const userid = req.user.srno;

    // console.log(review);
    // console.log(storeid);
    // console.log(username);
    // console.log(rate);
    // console.log(userid);
    const reviewquery =
      "INSERT INTO reviews1 (shop_id, review, rating, user_name,user_id) VALUES ($1, $2, $3, $4, $5)";
    db.query(reviewquery, [storeid, review, rate, username, userid]);
    res.redirect(`/showdetial?id=${storeid}`);
  } catch (error) {
    console.error("Error executing query", error.stack);
    res.status(500).send("Internal Server Error");
  }
});
////////////////////////////////////////////////////////////

passport.use(
  "local",
  new Strategy(async function verify(username, password, cd) {
    try {
      const result = await db.query(
        "SELECT * FROM userloginregister WHERE emailid = $1",
        [username]
      );
      if (result.rows.length > 0) {
        const user = result.rows[0];
        const storedHashedPassword = user.password;
        //verifying the password
        bcrypt.compare(password, storedHashedPassword, (err, result) => {
          if (err) {
            console.error("Error comparing passwords:", err);
            return cd(err);
          } else {
            if (result) {
              //Passed password check
              return cd(null, user);
            } else {
              //Did not pass password check
              return cd(null, false);
            }
          }
        });
      } else {
        return cd("User not found");
      }
    } catch (err) {
      console.log(err);
    }
  })
);

passport.use(
  "google",
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "https://foodrating.onrender.com/auth/google/secrets",
      //callbackURL: "http://localhost:3000/auth/google/secrets",
      userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",
      scope: ["profile", "email"],
    },
    async (accessToken, refreshToken, profile, cb) => {
      try {
        //console.log(profile);
        const result = await db.query(
          "SELECT * FROM userloginregister WHERE emailid = $1",
          [profile.email]
        );
        if (result.rows.length === 0) {
          const newUser = await db.query(
            "INSERT INTO userloginregister (emailid, phonenumber, password, name, username, profile_photo) VALUES ($1,$2,$3,$4,$5,$6)",
            [
              profile.email,
              profile.provider,
              profile.provider,
              profile.given_name,
              profile.family_name,
              profile.picture,
            ]
          );
          return cb(null, newUser.rows[0]);
        } else {
          return cb(null, result.rows[0]);
        }
      } catch (err) {
        return cb(err);
      }
    }
  )
);

passport.serializeUser((user, cb) => {
  cb(null, user);
});
passport.deserializeUser((user, cb) => {
  cb(null, user);
});

async function updateOverallRating() {
  try {
    const result = await db.query(`
      UPDATE food1
      SET overall_rating = subquery.avg_rating
      FROM (
        SELECT shop_id, AVG(rating) AS avg_rating
        FROM reviews1
        GROUP BY shop_id
      ) AS subquery
      WHERE food1.id = subquery.shop_id;
    `);
    console.log("Overall ratings updated successfully:");
  } catch (error) {
    console.error("Error updating overall ratings:", error);
  }
}

// Schedule the task to run every 12 hours
cron.schedule("0 */12 * * *", () => {
  console.log("Running scheduled task to update overall ratings...");
  updateOverallRating();
});


app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
