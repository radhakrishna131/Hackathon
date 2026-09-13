-- Sankalp Learning League: an append-only, database-controlled record of
-- meaningful learning achievements.  There are deliberately no INSERT,
-- UPDATE or DELETE grants for authenticated users.

CREATE TABLE public.learning_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL CHECK (points > 0 AND points <= 100),
  event_type text NOT NULL CHECK (event_type IN (
    'lesson_completed', 'assessment_passed', 'assessment_excellence',
    'course_completed', 'skill_improved', 'roadmap_completed'
  )),
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_type, reference_type, reference_id)
);

CREATE INDEX idx_learning_points_user_created ON public.learning_points (user_id, created_at DESC);
CREATE INDEX idx_learning_points_created ON public.learning_points (created_at DESC);
CREATE INDEX idx_learning_points_course_category ON public.learning_points ((metadata ->> 'course_category'))
  WHERE metadata ? 'course_category';
GRANT SELECT ON public.learning_points TO authenticated;
GRANT ALL ON public.learning_points TO service_role;
ALTER TABLE public.learning_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own learning points read" ON public.learning_points FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.award_learning_points(
  p_user_id uuid,
  p_points integer,
  p_event_type text,
  p_reference_type text,
  p_reference_id text,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.learning_points (user_id, points, event_type, reference_type, reference_id, metadata)
  VALUES (p_user_id, p_points, p_event_type, p_reference_type, p_reference_id, coalesce(p_metadata, '{}'::jsonb))
  ON CONFLICT (user_id, event_type, reference_type, reference_id) DO NOTHING;
END;
$$;
REVOKE ALL ON FUNCTION public.award_learning_points(uuid, integer, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.reward_lesson_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category text;
BEGIN
  SELECT c.category INTO v_category FROM public.courses c WHERE c.id = NEW.course_id;
  PERFORM public.award_learning_points(NEW.user_id, 5, 'lesson_completed', 'lesson', NEW.lesson_id::text,
    jsonb_build_object('course_id', NEW.course_id, 'course_category', v_category));
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reward_lesson_completion AFTER INSERT ON public.lesson_progress
FOR EACH ROW EXECUTE FUNCTION public.reward_lesson_completion();

CREATE OR REPLACE FUNCTION public.reward_assessment_attempt()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category text;
BEGIN
  IF NEW.passed THEN
    SELECT c.category INTO v_category FROM public.assessments a JOIN public.courses c ON c.id = a.course_id WHERE a.id = NEW.assessment_id;
    PERFORM public.award_learning_points(NEW.user_id, 25, 'assessment_passed', 'assessment', NEW.assessment_id::text,
      jsonb_build_object('score', NEW.score, 'course_category', v_category));
    -- Excellence is a once-per-assessment bonus, not a reward for retries.
    IF NEW.score >= 85 THEN
      PERFORM public.award_learning_points(NEW.user_id, 10, 'assessment_excellence', 'assessment', NEW.assessment_id::text,
        jsonb_build_object('score', NEW.score, 'course_category', v_category));
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reward_assessment_attempt AFTER INSERT ON public.attempts
FOR EACH ROW EXECUTE FUNCTION public.reward_assessment_attempt();

CREATE OR REPLACE FUNCTION public.reward_course_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_category text;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT category INTO v_category FROM public.courses WHERE id = NEW.course_id;
    PERFORM public.award_learning_points(NEW.user_id, 50, 'course_completed', 'course', NEW.course_id::text,
      jsonb_build_object('course_category', v_category));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reward_course_completion AFTER INSERT OR UPDATE OF status ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION public.reward_course_completion();

CREATE OR REPLACE FUNCTION public.reward_skill_improvement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- A material (10+ point) first improvement is recognised once per competency.
  IF TG_OP = 'UPDATE' AND NEW.score >= OLD.score + 10 THEN
    PERFORM public.award_learning_points(NEW.user_id, 20, 'skill_improved', 'skill', NEW.skill_id::text,
      jsonb_build_object('improvement', NEW.score - OLD.score, 'score', NEW.score));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reward_skill_improvement AFTER UPDATE OF score ON public.user_skills
FOR EACH ROW EXECUTE FUNCTION public.reward_skill_improvement();

CREATE OR REPLACE FUNCTION public.reward_roadmap_completion()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.award_learning_points((SELECT user_id FROM public.learning_roadmaps WHERE id = NEW.roadmap_id), 20, 'roadmap_completed', 'roadmap_item', NEW.id::text,
      jsonb_build_object('course_id', NEW.course_id));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reward_roadmap_completion AFTER INSERT OR UPDATE OF status ON public.roadmap_items
FOR EACH ROW EXECUTE FUNCTION public.reward_roadmap_completion();

-- A security-definer RPC exposes only public learning information and performs
-- aggregation/ranking in PostgreSQL. UTC is used for all period boundaries.
CREATE OR REPLACE FUNCTION public.get_learning_leaderboard(
  p_period text DEFAULT 'overall',
  p_category text DEFAULT NULL,
  p_limit integer DEFAULT 10,
  p_offset integer DEFAULT 0
) RETURNS TABLE(
  rank bigint, display_name text, avatar_url text, total_points bigint,
  period_points bigint, improvement_points bigint, league text, is_current_user boolean
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_start timestamptz; v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_period NOT IN ('overall', 'weekly', 'monthly', 'improved') THEN
    RAISE EXCEPTION 'Invalid leaderboard request';
  END IF;
  v_start := CASE p_period WHEN 'weekly' THEN date_trunc('week', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'
    WHEN 'monthly' THEN date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC' ELSE NULL END;
  RETURN QUERY
  WITH eligible AS (
    SELECT DISTINCT ur.user_id FROM public.user_roles ur WHERE ur.role = 'trainee'
  ), totals AS (
    SELECT e.user_id, coalesce(sum(lp.points), 0)::bigint AS all_time,
      coalesce(sum(lp.points) FILTER (WHERE v_start IS NULL OR lp.created_at >= v_start), 0)::bigint AS period_total,
      coalesce(sum(lp.points) FILTER (WHERE lp.event_type = 'skill_improved' AND lp.created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'), 0)::bigint AS improvement
    FROM eligible e LEFT JOIN public.learning_points lp ON lp.user_id = e.user_id
      AND (p_category IS NULL OR lp.metadata ->> 'course_category' = p_category)
    GROUP BY e.user_id
  ), ranked AS (
    SELECT t.*, rank() OVER (ORDER BY CASE WHEN p_period = 'improved' THEN t.improvement WHEN p_period = 'overall' THEN t.all_time ELSE t.period_total END DESC, t.user_id) AS position
    FROM totals t
    WHERE CASE WHEN p_period = 'improved' THEN t.improvement > 0 WHEN p_period = 'overall' THEN t.all_time > 0 ELSE t.period_total > 0 END
  ), visible AS (
    SELECT * FROM ranked WHERE position <= p_limit OR (v_uid IS NOT NULL AND position BETWEEN (SELECT coalesce(position, 0) - 2 FROM ranked WHERE user_id = v_uid) AND (SELECT coalesce(position, 0) + 2 FROM ranked WHERE user_id = v_uid))
  )
  SELECT v.position, coalesce(nullif(trim(p.full_name), ''), 'Learner'), p.avatar_url,
    v.all_time, v.period_total, v.improvement,
    CASE WHEN v.all_time >= 1000 THEN 'Platinum' WHEN v.all_time >= 500 THEN 'Gold' WHEN v.all_time >= 200 THEN 'Silver' ELSE 'Bronze' END,
    v.user_id = v_uid
  FROM visible v JOIN public.profiles p ON p.id = v.user_id
  ORDER BY v.position OFFSET greatest(p_offset, 0) LIMIT greatest(p_limit + 5, 1);
END;
$$;
GRANT EXECUTE ON FUNCTION public.get_learning_leaderboard(text, text, integer, integer) TO authenticated;
