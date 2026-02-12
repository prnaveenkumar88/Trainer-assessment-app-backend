const db = require('../config/mysql');

/* ================================
   CREATE ASSESSMENT (Assessor only)
================================ */
exports.createAssessment = async (req, res) => {
  try {

    const trainer_email = req.body.trainer_email;

    const {
      trainer_name,
      course_name,
      due_assessment,
      branch,
      team,
      assessment_date,
      assessment_time,
      assessor_name,
      attempt_number,
      feedback_attempt_1,
      feedback_attempt_2,
      feedback_attempt_3,
      final_remark
    } = req.body;

    // ✅ Convert scores safely
    const scores = {
      knowledge_stem: Number(req.body.knowledge_stem) || 0,
      stem_integration: Number(req.body.stem_integration) || 0,
      updated_stem_info: Number(req.body.updated_stem_info) || 0,
      course_outline: Number(req.body.course_outline) || 0,
      language_fluency: Number(req.body.language_fluency) || 0,
      lesson_preparation: Number(req.body.lesson_preparation) || 0,
      time_management: Number(req.body.time_management) || 0,
      student_engagement: Number(req.body.student_engagement) || 0,
      poise_confidence: Number(req.body.poise_confidence) || 0,
      voice_modulation: Number(req.body.voice_modulation) || 0,
      professional_appearance: Number(req.body.professional_appearance) || 0
    };

    const total_score =
      scores.knowledge_stem +
      scores.stem_integration +
      scores.updated_stem_info +
      scores.course_outline +
      scores.language_fluency +
      scores.lesson_preparation +
      scores.time_management +
      scores.student_engagement +
      scores.poise_confidence +
      scores.voice_modulation +
      scores.professional_appearance;

    // ✅ ENUM is string
    const status = attempt_number === "3" ? "COMPLETED" : "PENDING";

    const sql = `
      INSERT INTO assessments (
        trainer_name,
        trainer_email,
        course_name,
        due_assessment,
        branch,
        team,
        assessment_date,
        assessment_time,
        assessor_name,
        attempt_number,
        feedback_attempt_1,
        feedback_attempt_2,
        feedback_attempt_3,
        final_remark,
        knowledge_stem,
        stem_integration,
        updated_stem_info,
        course_outline,
        language_fluency,
        lesson_preparation,
        time_management,
        student_engagement,
        poise_confidence,
        voice_modulation,
        professional_appearance,
        total_score,
        scorecard_status
      )
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    `;

    await db.query(sql, [
      trainer_name,
      trainer_email,
      course_name,
      due_assessment,
      branch,
      team,
      assessment_date,
      assessment_time,
      assessor_name,
      attempt_number,
      feedback_attempt_1,
      feedback_attempt_2,
      feedback_attempt_3,
      final_remark,
      scores.knowledge_stem,
      scores.stem_integration,
      scores.updated_stem_info,
      scores.course_outline,
      scores.language_fluency,
      scores.lesson_preparation,
      scores.time_management,
      scores.student_engagement,
      scores.poise_confidence,
      scores.voice_modulation,
      scores.professional_appearance,
      total_score,
      status
    ]);

    res.status(201).json({
      message: "Assessment created successfully",
      total_score,
      status
    });

  } catch (error) {
    console.log("CREATE ERROR:", error);
    res.status(500).json({ error: error.message });
  }
};

exports.getUserByEmail = async (req, res) => {
  try {
    const { email } = req.params;

    const [rows] = await db.query(
      `SELECT
      name,
      email,
      date_of_joining,
      branch,
      department
      FROM users
      WHERE email = ?`,
      [email]
    );


    if (rows.length === 0) {
      return res.status(404).json({ message: "Trainer not found" });
    }

    res.json(rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



/* ================================
   GET ASSESSMENT BY ID
================================ */
exports.getAssessmentById = async (req, res) => {
  try {
    const { id } = req.params;

    const [rows] = await db.query(
      "SELECT * FROM assessments WHERE assessment_id = ?",
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: "Assessment not found" });
    }

    res.json(rows[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/* ================================
   GET ASSESSMENTS (Role-based)
================================ */
exports.getAssessments = async (req, res) => {
  try {

    const { role } = req.user;
    const { branch, team } = req.query;

    let sql = `SELECT * FROM assessments WHERE 1=1`;
    const params = [];

    // ✅ Trainer filtering via email
    if (role === 'trainer') {
      sql += ` AND trainer_email = ?`;
      params.push(req.user.email);
    }

    if (branch) {
      sql += ` AND branch = ?`;
      params.push(branch);
    }

    if (team) {
      sql += ` AND team = ?`;
      params.push(team);
    }

    const [rows] = await db.query(sql, params);
    res.json(rows);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


/* ================================
   UPDATE ATTEMPT
================================ */
exports.updateAttempt = async (req, res) => {
  try {

    const assessmentId = req.params.id;
    const { attempt_number, feedback, scores } = req.body;

    const [rows] = await db.query(
      'SELECT * FROM assessments WHERE assessment_id = ?',
      [assessmentId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assessment not found' });
    }

    const assessment = rows[0];

    // Lock completed
    if (assessment.scorecard_status === 'COMPLETED') {
      return res.status(403).json({
        message: 'Assessment is finalized and cannot be modified'
      });
    }

    const currentAttempt = Number(assessment.attempt_number);
    const newAttempt = Number(attempt_number);

    if (newAttempt !== currentAttempt + 1) {
      return res.status(400).json({
        message: `Invalid attempt flow. Current attempt is ${currentAttempt}`
      });
    }

    const total_score =
      scores.knowledge_stem +
      scores.stem_integration +
      scores.updated_stem_info +
      scores.course_outline +
      scores.language_fluency +
      scores.lesson_preparation +
      scores.time_management +
      scores.student_engagement +
      scores.poise_confidence +
      scores.voice_modulation +
      scores.professional_appearance;

    const status = newAttempt === '3' ? 'COMPLETED' : 'PENDING';

    const sql = `
      UPDATE assessments
      SET
        attempt_number = ?,
        feedback_attempt_${newAttempt} = ?,
        knowledge_stem = ?,
        stem_integration = ?,
        updated_stem_info = ?,
        course_outline = ?,
        language_fluency = ?,
        lesson_preparation = ?,
        time_management = ?,
        student_engagement = ?,
        poise_confidence = ?,
        voice_modulation = ?,
        professional_appearance = ?,
        total_score = ?,
        scorecard_status = ?
      WHERE assessment_id = ?
    `;

    await db.query(sql, [
      newAttempt,
      feedback,
      scores.knowledge_stem,
      scores.stem_integration,
      scores.updated_stem_info,
      scores.course_outline,
      scores.language_fluency,
      scores.lesson_preparation,
      scores.time_management,
      scores.student_engagement,
      scores.poise_confidence,
      scores.voice_modulation,
      scores.professional_appearance,
      total_score,
      status,
      assessmentId
    ]);

    res.json({
      message: `Attempt ${newAttempt} updated successfully`,
      total_score,
      status
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
