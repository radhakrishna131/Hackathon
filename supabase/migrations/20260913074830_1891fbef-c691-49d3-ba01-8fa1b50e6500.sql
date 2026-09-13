CREATE OR REPLACE FUNCTION public.sync_lesson_chunk()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id uuid;
  v_body text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    DELETE FROM public.content_chunks WHERE lesson_id = OLD.id;
    RETURN OLD;
  END IF;

  SELECT m.course_id INTO v_course_id FROM public.modules m WHERE m.id = NEW.module_id;
  v_body := trim(coalesce(NEW.title, '') || E'\n' || coalesce(NEW.content, ''));

  DELETE FROM public.content_chunks WHERE lesson_id = NEW.id;

  IF length(v_body) > 0 THEN
    INSERT INTO public.content_chunks (lesson_id, course_id, content, metadata)
    VALUES (
      NEW.id,
      v_course_id,
      left(v_body, 4000),
      jsonb_build_object('lesson_title', NEW.title, 'source', 'lesson')
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lessons_sync_chunk ON public.lessons;
CREATE TRIGGER trg_lessons_sync_chunk
AFTER INSERT OR UPDATE OF title, content, module_id OR DELETE ON public.lessons
FOR EACH ROW EXECUTE FUNCTION public.sync_lesson_chunk();

REVOKE EXECUTE ON FUNCTION public.sync_lesson_chunk() FROM anon, authenticated;