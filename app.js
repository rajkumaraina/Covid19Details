const express = require("express");
const app = express();
app.use(express.json());
const sqlite3 = require("sqlite3");
const { open } = require("sqlite");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const dbPath = path.join(__dirname, "covid19IndiaPortal.db");
let db = null;

const initailizeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.log(`Db Error at ${e.message}`);
    process.exit(1);
  }
};
initailizeDbAndServer();

const changeIntoCamelCase = (dataObject) => {
  return {
    stateId: dataObject.state_id,
    stateName: dataObject.state_name,
    population: dataObject.population,
  };
};

const changeIntoCamelCase1 = (dataObject) => {
  return {
    districtId: dataObject.district_id,
    districtName: dataObject.district_name,
    stateId: dataObject.state_id,
    cases: dataObject.cases,
    cured: dataObject.cured,
    active: dataObject.active,
    deaths: dataObject.deaths,
  };
};

const authenticateToken = (request, response, next) => {
  let jwtToken;
  let authHeader = request.headers["authorization"];
  if (authHeader === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    jwtToken = authHeader.split(" ")[1];
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "dhgdghdgdkf", async (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      });
    }
  }
};

//Register API
app.post("/register", async (request, response) => {
  const { username, name, password, gender, location } = request.body;
  const CheckUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(CheckUserQuery);
  const hashedPassword = await bcrypt.hash(password, 10);
  if (dbUser === undefined) {
    const registerUserQuery = `INSERT INTO user(username,name,password,gender,location)VALUES('${username}','${name}','${hashedPassword}','${gender}','${location}');`;
    const dbResponse = await db.run(registerUserQuery);
    response.send("User Registered Successfully");
  } else {
    response.status(400);
    response.send("User already Exits");
  }
});

// Login API
app.post("/login", async (request, response) => {
  const { username, password } = request.body;
  const CheckUserQuery = `SELECT * FROM user WHERE username='${username}';`;
  const dbUser = await db.get(CheckUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const checkPassword = await bcrypt.compare(password, dbUser.password);
    if (checkPassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "dhgdghdgdkf");
      response.send({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  }
});

//API 1
app.get("/states/", authenticateToken, async (request, response) => {
  const statesQuery = `SELECT * FROM state;`;
  const dbResponse = await db.all(statesQuery);
  response.send(dbResponse.map((eachItem) => changeIntoCamelCase(eachItem)));
});

//API 2
app.get("/states/:stateId/", authenticateToken, async (request, response) => {
  const { stateId } = request.params;
  const stateQuery = `SELECT * FROM state WHERE state_id=${stateId};`;
  const dbResponse = await db.get(stateQuery);
  response.send(changeIntoCamelCase(dbResponse));
});

//API 3
app.post("/districts/", authenticateToken, async (request, response) => {
  const { districtName, stateId, cases, cured, active, deaths } = request.body;
  const districtQuery = `INSERT INTO district (district_name,state_id,cases,cured,active,deaths)VALUES('${districtName}',${stateId},${cases},${cured},${active},${deaths});`;
  await db.run(districtQuery);
  response.send("District Successfully Added");
});

//API 4
app.get(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `SELECT * FROM district WHERE district_id=${districtId};`;
    const dbResponse = await db.get(districtQuery);
    response.send(changeIntoCamelCase1(dbResponse));
  }
);

//API 5
app.delete(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const districtQuery = `DELETE FROM district WHERE district_id=${districtId};`;
    const dbResponse = await db.get(districtQuery);
    response.send("District Removed");
  }
);

//API 6
app.put(
  "/districts/:districtId/",
  authenticateToken,
  async (request, response) => {
    const { districtId } = request.params;
    const {
      districtName,
      stateId,
      cases,
      cured,
      active,
      deaths,
    } = request.body;
    const districtQuery = `UPDATE district SET district_name='${districtName}',state_id=${stateId},cases=${cases},cured=${cured},active=${active},deaths=${deaths} WHERE district_id=${districtId};`;
    await db.run(districtQuery);
    response.send("District Details Updated");
  }
);

//API 7
app.get(
  "/states/:stateId/stats/",
  authenticateToken,
  async (request, response) => {
    const { stateId } = request.params;
    const stateStatisticsQuery = `SELECT SUM(cases) AS totalCases,SUM(cured) AS totalCured,SUM(active) AS totalActive,SUM(deaths) AS totalDeaths FROM state INNER JOIN district ON state.state_id=district.state_id WHERE state.state_id=${stateId};`;
    const dbResponse = await db.get(stateStatisticsQuery);
    response.send(dbResponse);
  }
);
module.exports = app;
