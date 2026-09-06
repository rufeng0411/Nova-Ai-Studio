# -*- coding: utf-8 -*-
# 摘录自 NovaPage 仓库 backend/services/task_manager.py
# 函数: export_editable_pptx_with_recursive_analysis_task (约 L2326-L2628)
# 迁入其他项目时请改为独立模块，并替换 models.Task / Project / FileService 等依赖。
        try:
            # Get project
            project = Project.query.get(project_id)
            if not project:
                raise ValueError(f'Project {project_id} not found')

            # 璇诲彇椤圭洰鐨勫鍑鸿缃細鏄惁鍏佽杩斿洖鍗婃垚鍝?            export_allow_partial = project.export_allow_partial or False
            fail_fast = not export_allow_partial
            logger.info(f"瀵煎嚭璁剧疆: export_allow_partial={export_allow_partial}, fail_fast={fail_fast}")

            # IMPORTANT: Expire cached objects to ensure fresh data from database
            # This prevents reading stale generated_image_path after page regeneration
            db.session.expire_all()

            # Get pages (filtered by page_ids if provided)
            pages = get_filtered_pages(project_id, page_ids)
            if not pages:
                raise ValueError('No pages found for project')
            
            image_paths = []
            for page in pages:
                abs_path = resolve_export_page_image_abs_path(page, file_service)
                if abs_path:
                    logger.info(
                        '[export_editable_pptx] task=%s project=%s page=%s image=%s',
                        task_id,
                        project_id,
                        getattr(page, 'id', '?'),
                        abs_path,
                    )
                    image_paths.append(abs_path)
            
            if not image_paths:
                raise ValueError('No generated images found for project')
            
            logger.info(
                '[export_editable_pptx] task=%s project=%s pages=%s extractor=%s inpaint=%s max_depth=%s',
                task_id,
                project_id,
                len(image_paths),
                export_extractor_method,
                export_inpaint_method,
                max_depth,
            )
            
            # 鍒濆鍖栦换鍔¤繘搴︼紙鍖呭惈娑堟伅鏃ュ織锛?            task = Task.query.get(task_id)
            if task:
                task.status = "PROCESSING"
                task.heartbeat_at = datetime.utcnow()
                task.set_progress({
                    "total": 100,  # 浣跨敤鐧惧垎姣?                    "completed": 0,
                    "failed": 0,
                    "current_step": "鍑嗗涓?..",
                    "percent": 0,
                    "messages": ["馃殌 寮€濮嬪鍑哄彲缂栬緫PPTX..."],  # 娑堟伅鏃ュ織
                })
                db.session.commit()
            
            # 杩涘害鍥炶皟鍑芥暟 - 鏇存柊鏁版嵁搴撲腑鐨勮繘搴?            progress_messages = ["馃殌 寮€濮嬪鍑哄彲缂栬緫PPTX..."]
            max_messages = 10  # 鏈€澶氫繚鐣欐渶杩?0鏉℃秷鎭?            _last_heartbeat_monotonic = [0.0]

            def progress_callback(step: str, message: str, percent: int):
                """鏇存柊浠诲姟杩涘害鍒版暟鎹簱"""
                nonlocal progress_messages
                try:
                    # 娣诲姞鏂版秷鎭埌鏃ュ織
                    new_message = f"[{step}] {message}"
                    progress_messages.append(new_message)
                    # 鍙繚鐣欐渶杩戠殑娑堟伅
                    if len(progress_messages) > max_messages:
                        progress_messages = progress_messages[-max_messages:]
                    
                    # 鏇存柊鏁版嵁搴?                    task = Task.query.get(task_id)
                    if task:
                        task.status = "PROCESSING"
                        task.set_progress({
                            "total": 100,
                            "completed": percent,
                            "failed": 0,
                            "current_step": message,
                            "percent": percent,
                            "messages": progress_messages.copy(),
                        })
                        now_m = time.monotonic()
                        if now_m - _last_heartbeat_monotonic[0] >= 25.0 or percent <= 1 or percent >= 99:
                            task.heartbeat_at = datetime.utcnow()
                            _last_heartbeat_monotonic[0] = now_m
                        db.session.commit()
                except Exception as e:
                    logger.warning(f"鏇存柊杩涘害澶辫触: {e}")
            
            # Step 1: 鍑嗗宸ヤ綔
            logger.info("Step 1: 鍑嗗宸ヤ綔...")
            progress_callback("鍑嗗", f"鎵惧埌 {len(image_paths)} 寮犲够鐏墖鍥剧墖", 2)
            
            # 鍑嗗杈撳嚭璺緞
            exports_dir = os.path.join(app.config['UPLOAD_FOLDER'], project_id, 'exports')
            os.makedirs(exports_dir, exist_ok=True)

            filename = build_project_export_filename(
                project,
                '.pptx',
                explicit=filename,
                fallback_id=project_id,
                pages=pages,
            )
            filename, output_path = allocate_unique_export_path(exports_dir, filename)
            logger.info(f"瀵煎嚭鏂囦欢鍚? {filename}")
            
            # 鑾峰彇绗竴寮犲浘鐗囩殑灏哄浣滀负鍙傝€?            first_img = Image.open(image_paths[0])
            slide_width, slide_height = first_img.size
            first_img.close()
            
            logger.info(f"骞荤伅鐗囧昂瀵? {slide_width}x{slide_height}")
            logger.info(f"閫掑綊娣卞害: {max_depth}, 骞跺彂鏁? {max_workers}")
            progress_callback("鍑嗗", f"骞荤伅鐗囧昂瀵? {slide_width}脳{slide_height}", 3)
            
            # Step 2: 鏂囧瓧灞炴€ф彁鍙栧櫒锛堝彲璺宠繃浠ュ姞閫燂紱PPTX 浠嶆湁鏂囧瓧妗嗕笌鐗堝紡锛岀矖浣?棰滆壊绛夊彲鑳界敤榛樿锛?            text_attribute_extractor = None
            if skip_text_styles:
                progress_callback("鍑嗗", "宸茶烦杩囬€愬厓绱犳枃瀛楁牱寮忔彁鍙栵紙鍔犻€熸ā寮忥級", 5)
                logger.info("export_editable_pptx: skip_text_styles=True锛屼笉鍒濆鍖?TextAttributeExtractor")
            else:
                from services.image_editability import TextAttributeExtractorFactory
                text_attribute_extractor = TextAttributeExtractorFactory.create_caption_model_extractor()
                progress_callback("鍑嗗", "鏂囧瓧灞炴€ф彁鍙栧櫒宸插垵濮嬪寲", 5)
            
            # Step 3: 璋冪敤瀵煎嚭鏂规硶锛堜娇鐢ㄩ」鐩殑瀵煎嚭璁剧疆锛?            logger.info(f"Step 3: 鍒涘缓鍙紪杈慞PTX (extractor={export_extractor_method}, inpaint={export_inpaint_method}, fail_fast={fail_fast})...")
            progress_callback("閰嶇疆", f"鎻愬彇鏂规硶: {export_extractor_method}, 鑳屾櫙淇: {export_inpaint_method}", 6)

            _, export_warnings = ExportService.create_editable_pptx_with_recursive_analysis(
                image_paths=image_paths,
                output_file=output_path,
                slide_width_pixels=slide_width,
                slide_height_pixels=slide_height,
                max_depth=max_depth,
                max_workers=max_workers,
                text_attribute_extractor=text_attribute_extractor,
                progress_callback=progress_callback,
                export_extractor_method=export_extractor_method,
                export_inpaint_method=export_inpaint_method,
                fail_fast=fail_fast
            )
            
            logger.info(f"鉁?鍙紪杈慞PTX宸插垱寤? {output_path}")
            
            # Step 4: 鏍囪浠诲姟瀹屾垚
            download_path = build_export_download_path(project_id, filename)
            
            # 娣诲姞瀹屾垚娑堟伅
            progress_messages.append("鉁?瀵煎嚭瀹屾垚锛?)
            
            # 娣诲姞璀﹀憡淇℃伅锛堝鏋滄湁锛?            warning_messages = []
            if export_warnings and export_warnings.has_warnings():
                warning_messages = export_warnings.to_summary()
                progress_messages.extend(warning_messages)
                logger.warning(f"瀵煎嚭鏈?{len(warning_messages)} 鏉¤鍛?)
            
            task = Task.query.get(task_id)
            if task:
                task.status = 'COMPLETED'
                task.completed_at = datetime.utcnow()
                task.set_progress({
                    "total": 100,
                    "completed": 100,
                    "failed": 0,
                    "current_step": "鉁?瀵煎嚭瀹屾垚",
                    "percent": 100,
                    "messages": progress_messages,
                    "download_url": download_path,
                    "filename": filename,
                    "method": "recursive_analysis",
                    "max_depth": max_depth,
                    "warnings": warning_messages,  # 鍗曠嫭鐨勮鍛婂垪琛?                    "warning_details": export_warnings.to_dict() if export_warnings else {}  # 璇︾粏璀﹀憡淇℃伅
                })
                from models import GeneratedOutput
                from utils.export_filename import resolve_project_export_display_name

                friendly_name = resolve_project_export_display_name(
                    project, pages=pages, fallback_id=project_id
                )
                GeneratedOutput.query.filter_by(
                    project_id=project_id, output_type='ppt'
                ).delete()
                db.session.add(
                    GeneratedOutput(
                        output_type='ppt',
                        file_path=download_path,
                        display_name=friendly_name,
                        project_id=project_id,
                        task_id=task_id,
                        metadata_=None,
                    )
                )
                db.session.commit()
                logger.info(f"鉁?浠诲姟 {task_id} 瀹屾垚 - 閫掑綊鍒嗘瀽瀵煎嚭鎴愬姛锛堟繁搴?{max_depth}锛?)

        except ExportError as e:
            # 瀵煎嚭閿欒锛坒ail_fast 妯″紡涓嬬殑璇︾粏閿欒锛?            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"鉁?浠诲姟 {task_id} 瀵煎嚭澶辫触: {e.message}")
            logger.error(f"閿欒绫诲瀷: {e.error_type}, 璇︽儏: {e.details}")

            # 鏍囪浠诲姟澶辫触锛屽寘鍚缁嗛敊璇俊鎭?            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                # 鏋勫缓璇︾粏鐨勯敊璇秷鎭?                error_message = f"{e.message}"
                if e.help_text:
                    error_message += f"\n\n馃挕 {e.help_text}"
                task.error_message = error_message
                task.completed_at = datetime.utcnow()
                # 鍦?progress 涓繚瀛樿缁嗛敊璇俊鎭?                task.set_progress({
                    "total": 100,
                    "completed": 0,
                    "failed": 1,
                    "current_step": "瀵煎嚭澶辫触",
                    "percent": 0,
                    "error_type": e.error_type,
                    "error_details": e.details,
                    "help_text": e.help_text
                })
                db.session.commit()

        except Exception as e:
            import traceback
            error_detail = traceback.format_exc()
            logger.error(f"鉁?浠诲姟 {task_id} 澶辫触: {error_detail}")
            
            # 鏍囪浠诲姟澶辫触
            task = Task.query.get(task_id)
            if task:
                task.status = 'FAILED'
                task.error_message = str(e)
                task.completed_at = datetime.utcnow()
                db.session.commit()


def gensearcher_run_task(task_id: str, payload: Dict[str, Any], app=None):
    """鍚庡彴 GR锛圙en-Searcher锛変换鍔★細妫€绱?鈫?娴忚鎽樿 鈫?鍙傝€冨浘 鈫?LLM 姹囨€伙紝鍐欏叆 Task.result_json銆?""
    if app is None:
        raise ValueError("Flask app instance must be provided")

    with app.app_context():
        from services.gen_searcher.runner import run_gr_sync

        task = Task.query.get(task_id)
        if not task:
            logger.error("GENSEARCHER_RUN task %s not found", task_id)
            return

        try:
            task.status = "PROCESSING"
            task.set_progress(
                {
                    "total": 100,
                    "completed": 10,
                    "percent": 10,
                    "current_step": "running",
                    "message": "GR 妫€绱笌姹囨€讳腑鈥?,
                }
            )
            db.session.commit()

            message = str(payload.get("message") or "").strip()
            thread_id = task.origin_thread_id
            reason = "user_forced_on" if payload.get("force_run") else "async_task"

            run_res = run_gr_sync(
                message=message,
                reason_code=reason,
                thread_id=thread_id,
                task_id=task_id,
                emit=None,
            )
            rd = run_res.to_result_dict()

            task.status = "COMPLETED"
            task.set_result({"gr": rd})
            task.set_progress(
                {
                    "total": 100,
                    "completed": 100,
                    "percent": 100,
                    "current_step": "done",
                    "message": "GR 宸插畬鎴?,
                }
            )
            task.completed_at = datetime.utcnow()
            db.session.commit()
        except Exception as e:
            logger.exception("GENSEARCHER_RUN failed task_id=%s", task_id)
            task = Task.query.get(task_id)
            if task:
                task.status = "FAILED"
                task.error_message = str(e)[:2000]
                task.completed_at = datetime.utcnow()
                task.set_progress(
                    {
                        "total": 100,
                        "completed": 0,
                        "percent": 0,
                        "current_step": "failed",
                        "message": str(e)[:500],
                    }
