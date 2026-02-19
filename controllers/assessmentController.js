const db = require('../config/mysql');

const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

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

    // Convert scores safely
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

    // ENUM is string
    const status = Number(attempt_number) === 3 ? 'COMPLETED' : 'PENDING';

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
      message: 'Assessment created successfully',
      total_score,
      status
    });

  } catch (error) {
    console.log('CREATE ERROR:', error);
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
      return res.status(404).json({ message: 'Trainer not found' });
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
      'SELECT * FROM assessments WHERE assessment_id = ?',
      [id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Assessment not found' });
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
    const search = typeof req.query.search === 'string'
      ? req.query.search.trim()
      : '';
    const branch = typeof req.query.branch === 'string'
      ? req.query.branch.trim()
      : '';
    const team = typeof req.query.team === 'string'
      ? req.query.team.trim()
      : '';

    const hasQueryParams =
      req.query.page !== undefined ||
      req.query.limit !== undefined ||
      req.query.search !== undefined ||
      req.query.branch !== undefined ||
      req.query.team !== undefined;

    const whereClauses = ['1=1'];
    const whereParams = [];

    // Trainer sees only own rows
    if (role === 'trainer') {
      whereClauses.push('trainer_email = ?');
      whereParams.push(req.user.email);
    }

    if (search) {
      whereClauses.push(
        '(trainer_name LIKE ? OR trainer_email LIKE ? OR course_name LIKE ?)'
      );
      const searchTerm = `%${search}%`;
      whereParams.push(searchTerm, searchTerm, searchTerm);
    }

    if (branch) {
      whereClauses.push('branch LIKE ?');
      whereParams.push(`%${branch}%`);
    }

    if (team) {
      whereClauses.push('team LIKE ?');
      whereParams.push(`%${team}%`);
    }

    const whereSql = whereClauses.join(' AND ');

    // Backward compatibility: if no filter/paging query, return full array.
    if (!hasQueryParams) {
      const [rows] = await db.query(
        `SELECT * FROM assessments WHERE ${whereSql} ORDER BY assessment_id DESC`,
        whereParams
      );
      return res.json(rows);
    }

    const page = toPositiveInt(req.query.page, 1);
    const limit = Math.min(toPositiveInt(req.query.limit, 25), 100);

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total FROM assessments WHERE ${whereSql}`,
      whereParams
    );

    const total = Number(countRows?.[0]?.total || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const currentPage = Math.min(page, totalPages);
    const offset = (currentPage - 1) * limit;

    const [rows] = await db.query(
      `SELECT * FROM assessments
       WHERE ${whereSql}
       ORDER BY assessment_id DESC
       LIMIT ? OFFSET ?`,
      [...whereParams, limit, offset]
    );

    res.json({
      items: rows,
      pagination: {
        total,
        page: currentPage,
        limit,
        totalPages,
        hasNextPage: currentPage < totalPages,
        hasPreviousPage: currentPage > 1
      }
    });

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

    const status = newAttempt === 3 ? 'COMPLETED' : 'PENDING';

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
