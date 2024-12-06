import express from "express";

import multer from "multer";
import xlsx from "xlsx";

import { getRows } from "./utils/getRows.js";
import { openDb } from "./db.js";

const app = express();
app.use(express.static("./public"));
app.use(express.urlencoded({ extended: true }));

const port = 3000;

app.use(express.json());
app.set("view engine", "ejs");

const CATEGORIES_ENGLISH = {
  "-A1": 0,
  A1: 0,
  A2: 0,
  B1: 0,
  B2: 0,
  C1: 0,
  C2: 0,
};
// const db = new sqlite3.Database("students-bis.db");
const db = await openDb();
await db.run(`
  CREATE TABLE IF NOT EXISTS "students" (
    "ID" INTEGER NOT NULL UNIQUE,
    "name" TEXT NOT NULL,
    "career" TEXT NOT NULL, -- Cambiado a TEXT si es una carrera escrita
    "status" TEXT NOT NULL,
    "genre" INTEGER NOT NULL,
    "generation" TEXT,
    "cuatrimester" INTEGER, -- Corregida la ortografía
    "gen_bis" INTEGER,
    "toefl_score" INTEGER,
    "toefl_grade" TEXT,
    "mock_score" INTEGER,
    "mock_grade" INTEGER,
    "comments" TEXT,
    PRIMARY KEY("ID")
  )
`);
db.close();

const upload = multer();

app.get("/", async (req, res) => {
  const db = await openDb();
  let students = [];
  const tContent = await db.all("SELECT * FROM students", (err, row) => {
    console.log(err);
  });
  const countLevels = (level) => {
    return tContent.filter((row) => row["mock_grade"] === level);
  };

  if (req.query.bySearch && req.query.value) {
    const { bySearch, value } = req.query;

    const db = await openDb();
    const res = await db.all(
      `SELECT * FROM students WHERE ${bySearch} LIKE ?`,
      [`%${value}%`]
    );
    students = [...res];
  }

  await db.close();
  res.render("pages/index", {
    tHeads: [
      "ID",
      "Nombre",
      "Carrera",
      "Estado",
      "Sexo",
      "Cuatrimestre",
      "Generación",
      "Gen. Bis",
      "Puntuación TOEFL",
      "Grado TOEFL",
      "Puntuación MOCK",
      "Grado MOCK",
      "Comentarios",
    ],
    tContent,
    englishLevels: {
      levels: ["-A1", "A1", "A2", "B1", "B2", "C1"],
      count: [
        countLevels("-A1").length,
        countLevels("A1").length,
        countLevels("A2").length,
        countLevels("B1").length,
        countLevels("B2").length,
        countLevels("C1").length,
      ],
    },
    students,
  });
});

app.get("/upload", (req, res) => {
  res.render("pages/upload");
});

app.get("/reports", async (req, res) => {
  const arrayStatus = req.query.status
    ? Array.isArray(req.query.status)
      ? req.query.status.map((status) => status.toUpperCase())
      : [req.query.status.toUpperCase()]
    : ["ACTIVO"];

  const placeholders = arrayStatus.map(() => "?").join(",");

  try {
    const db = await openDb();
    const mockCareers = await db.all(
      `
      SELECT mock_grade,count(mock_grade) as totalStudents, career 
        FROM students
        WHERE mock_grade IS NOT NULL AND mock_grade != "" AND status IN (${placeholders})
        GROUP BY mock_grade, career
        ORDER BY career;
    `,
      arrayStatus
    );

    const toeflCareers = await db.all(
      `
      SELECT toefl_grade,count(toefl_grade) as totalStudents, career 
        FROM students 
        WHERE toefl_grade IS NOT NULL AND toefl_grade != "" AND status IN (${placeholders})
        GROUP BY toefl_grade, career 
        ORDER BY career;
    `,
      arrayStatus
    );

    const totalGradesMock = await db.all(
      `
      SELECT 
      COUNT(*) AS total,
      mock_grade AS grade
      FROM students
      WHERE mock_grade IN ("-A1", "A1", "A2", "B1","B2","C1","C2") AND status IN (${placeholders}) 
      GROUP BY mock_grade;
      `,
      arrayStatus
    )

    const totalGradesToefl = await db.all(
      `
      SELECT 
      COUNT(1) AS total,
      toefl_grade AS grade
      FROM students
      WHERE toefl_grade IN ("A1", "A2", "B1", "B2", "C1", "C2") AND status IN (${placeholders})
      GROUP BY toefl_grade;
      `,
      arrayStatus
    )

    const totalStudentsInCareer = await db.all(
      `
    SELECT career, genre, COUNT(genre) as totalGenre
    FROM students
    WHERE mock_grade IS NOT NULL AND mock_grade != "" AND status IN (${placeholders})
    GROUP BY genre, career
    ORDER BY career;
    `,
      arrayStatus
    );

    const footerMock = {
      "-A1": 0,
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0
    }
    const footerToefl = {
      A1: 0,
      A2: 0,
      B1: 0,
      B2: 0,
      C1: 0,
      C2: 0
    }

    totalGradesMock.forEach(m => footerMock[m.grade] += m.total)
    console.log(totalGradesToefl);
    totalGradesToefl.forEach(m => footerToefl[m.grade] += m.total)

    await db.close();

    const drillDownToQualifications = (career) => {
      const mockCareer = mockCareers.filter((row) => row["career"] === career);
      const levels = structuredClone(CATEGORIES_ENGLISH);
      mockCareer.forEach(({ mock_grade, totalStudents }) => {
        if (levels[mock_grade] !== undefined) {
          levels[mock_grade] = totalStudents;
        }
      });
      return {
        career,
        levels,
      };
    };

    const filterGenreForCareer = (career) => {
      const studentsFiltered = totalStudentsInCareer.filter(
        (row) => row["career"] === career
      );
      if (studentsFiltered.length <= 0) {
        return {
          H: 0,
          M: 0,
          total: 0,
        };
      }
      const manCount = studentsFiltered.find(({ genre }) => genre === 1)
        ? studentsFiltered.find(({ genre }) => genre === 1).totalGenre
        : 0;
      const womanCount = studentsFiltered.find(({ genre }) => genre === 0)
        ? studentsFiltered.find(({ genre }) => genre === 0).totalGenre
        : 0;
      return {
        H: manCount,
        M: womanCount,
        total: studentsFiltered.reduce(
          (acc, { totalGenre }) => acc + totalGenre,
          0
        ),
      };
    };

    const getGradeCalificationsToefl = (career) => {
      const toeflCareer = toeflCareers.filter(
        (row) => row["career"] === career
      );
      const levels = {
        A1: 0,
        A2: 0,
        B1: 0,
        B2: 0,
        C1: 0,
        C2: 0,
      };
      toeflCareer.forEach(({ toefl_grade, totalStudents }) => {
        if (levels[toefl_grade] !== undefined) {
          levels[toefl_grade] = totalStudents;
        }
      });
      return {
        levels,
        total: toeflCareer.reduce(
          (acc, { totalStudents }) => acc + totalStudents,
          0
        ),
      };
    };

    const mock = {
      IE: {
        label: "Igeniería en Energía",
        ...drillDownToQualifications("IE"),
        ...filterGenreForCareer("IE"),
      },
      II: {
        label: "Igeniería Industrial",
        ...drillDownToQualifications("II"),
        ...filterGenreForCareer("II"),
      },
      ITI: {
        label: "Igeniería en Tecnologías de la Información",
        ...drillDownToQualifications("ITI"),
        ...filterGenreForCareer("ITI"),
      },
      IET: {
        label: "Igeniería Electrónica y Telecomunicaciones",
        ...drillDownToQualifications("IET"),
        ...filterGenreForCareer("IET"),
      }
    };

    const toefl = {
      IE: {
        label: "Igeniería en Energía",
        ...getGradeCalificationsToefl("IE"),
      },
      II: {
        label: "Igeniería Industrial",
        ...getGradeCalificationsToefl("II"),
      },
      ITI: {
        label: "Igeniería en Tecnologías de la Información",
        ...getGradeCalificationsToefl("ITI"),
      },
      IET: {
        label: "Igeniería Electrónica y Telecomunicaciones",
        ...getGradeCalificationsToefl("IET"),
      },
    };

    res.render("pages/reports", {
      mock,
      toefl,
      footerMock:Object.entries(footerMock).map(el => el[1]),
      footerToefl: Object.entries(footerToefl).map(el => el[1])
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.get("/reports/export", async (req, res) => {
  try {
    const db = await openDb();
    const tContent = await db.all(
      `
    SELECT
      ID,
      name AS nombre,
      career AS carrera,
      status AS estado,
      generation AS generacion,	
      genre AS sexo,
      cuatrimester AS cuatrimestre,
      gen_bis AS 'generacion bis',
      toefl_score AS 'toefl score',
      toefl_grade AS 'toefl grade',
      mock_score AS 'mock score',	
      mock_grade AS 'mock grade',	
      comments AS comentarios
    FROM students
    `,
      (err, row) => {
        console.log(err);
      }
    );
    await db.close();

    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(tContent);
    xlsx.utils.book_append_sheet(workbook, worksheet, "Students");
    const buffer = xlsx.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=students.xlsx");
    res.send(buffer);
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.get("/gen-toefl", async (req, res) => {
  try {
    const db = await openDb();
    const result = await db.all(
      'SELECT generation FROM students WHERE toefl_grade != "" GROUP BY generation'
    );
    await db.close();
    res.json(result.map((res) => res.generation));
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.post("/student", async (req, res) => {
  const {
    id,
    name,
    career,
    status,
    genre,
    cuatrimester,
    genBis,
    generation,
    toeflScore,
    toeflGrade,
    mockScore,
    mockGrade,
    comments,
  } = req.body;
  try {
    if (
      id === "" ||
      name === "" ||
      career === "" ||
      status === "" ||
      genre === "" ||
      cuatrimester === "" ||
      generation === "" ||
      genBis === ""
    ) {
      return res.status(400).json({ message: "Datos incompletos" });
    }

    const db = await openDb();
    await db.run(
      "INSERT INTO students (id, name, career, status, genre, cuatrimester, gen_bis, generation, toefl_score, toefl_grade, mock_score, mock_grade, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      id,
      name,
      career,
      status,
      genre,
      cuatrimester,
      genBis,
      generation,
      toeflScore,
      toeflGrade,
      mockScore,
      mockGrade,
      comments
    );
    await db.close();
    res.json({
      message: "Agregado correctamente",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.get("/student", async (req, res) => {
  const { id } = req.query;
  try {
    const db = await openDb();
    console.log()
    const student = await db.get("SELECT * FROM students WHERE ID = ?", id);
    console.log(student, id)
    if(!student){
      return res.status(404).json({message:"Alumno no encontrado" })
    }
    await db.close();
    res.render("pages/student", {
      student,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.put("/student/:id", async (req, res) => {
  const { id } = req.params;
  const {
    name,
    career,
    status,
    genre,
    cuatrimester,
    genBis,
    generation,
    toeflScore,
    toeflGrade,
    mockScore,
    mockGrade,
    comments,
  } = req.body;
  console.log(req.body);
  if (
    id === undefined ||
    !name ||
    !career ||
    !status ||
    !genre ||
    !cuatrimester ||
    !genBis ||
    !generation
  ) {
    return res.status(400).json({ message: "Datos incompletos" });
  }

  try {
    const db = await openDb();
    await db.run(
      "UPDATE students SET name = ?, career = ?, status = ?, genre = ?, cuatrimester = ?, gen_bis = ?, generation = ?, toefl_score = ?, toefl_grade = ?, mock_score = ?, mock_grade = ?, comments = ? WHERE ID = ?",
      name,
      career,
      status,
      genre,
      cuatrimester,
      genBis,
      generation,
      toeflScore,
      toeflGrade,
      mockScore,
      mockGrade,
      comments,
      id
    );
    await db.close();
    res.json({
      message: "TEst",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Error al obtener los datos" });
  }
});

app.post("/upload-statistics", upload.single("archivo"), async (req, res) => {
  const file = req.file;

  if (!file) {
    return res.status(400).json({ message: "No se ha cargado ningún archivo" });
  }

  try {
    const db = await openDb();

    const fileBuffer = file.buffer;

    const rows = getRows({ fileBuffer, sheet: 0 });

    await Promise.all(
      rows.map(async (row) => {
        const exist = await db.get(
          "SELECT * FROM students WHERE ID = ?",
          row["ID"]
        );
        if (exist) {
          await db.run(
            "UPDATE students SET name = ?, career = ?, status = ?, genre = ?, cuatrimester = ?, gen_bis = ?, generation = ?, toefl_score = ?, toefl_grade = ?, mock_score = ?, mock_grade = ?, comments = ? WHERE ID = ?",
            row["Nombre"].trim(),
            row["CARRERA"].trim(),
            row["estatus"].trim(),
            row["sexo"],
            row["cuatris"],
            row["GEN BIS"],
            row["generacion"],
            row["toefl score"],
            (row["toefl grade"] || "").trim(),
            row["mock score"],
            (row["mock grade"] || "").trim(),
            "",
            row["ID"]
          );
          return;
        }

        await db.run(
          "INSERT INTO students (ID, name, career, status, genre, cuatrimester, gen_bis, generation, toefl_score, toefl_grade, mock_score, mock_grade, comments) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?, ?)",
          row["ID"],
          row["Nombre"].trim(),
          row["CARRERA"].trim(),
          row["estatus"].trim(),
          row["sexo"],
          row["cuatris"],
          row["GEN BIS"],
          row["generacion"],
          row["toefl score"],
          (row["toefl grade"] || "").trim(),
          row["mock score"],
          (row["mock grade"] || "").trim(),
          ""
        );
      })
    );

    console.log("Terminado");
    return res.status(200).json({ message: "Archivo procesado correctamente" });
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "Error al procesar el archivo" });
  }
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
