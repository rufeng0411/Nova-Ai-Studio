# -*- coding: utf-8 -*-
# 摘录自 backend/controllers/export_controller.py
# 路由: POST /<project_id>/export/editable-pptx
    """
    POST /api/projects/{project_id}/export/editable-pptx - 瀵煎嚭鍙紪杈慞PTX锛堝紓姝ワ級
    
    浣跨敤閫掑綊鍒嗘瀽鏂规硶锛堟敮鎸佷换鎰忓昂瀵搞€侀€掑綊瀛愬浘鍒嗘瀽锛?    
    杩欎釜绔偣鍒涘缓涓€涓紓姝ヤ换鍔℃潵鎵ц浠ヤ笅鎿嶄綔锛?    1. 閫掑綊鍒嗘瀽鍥剧墖锛堟敮鎸佷换鎰忓昂瀵稿拰鍒嗚鲸鐜囷級
    2. 杞崲涓篜DF骞朵笂浼燤inerU璇嗗埆
    3. 鎻愬彇鍏冪礌bbox鍜岀敓鎴恈lean background锛坕npainting锛?    4. 閫掑綊澶勭悊鍥剧墖/鍥捐〃涓殑瀛愬厓绱?    5. 鍒涘缓鍙紪杈慞PTX
    
    Request body (JSON):
        {
            "filename": "optional_custom_name.pptx",
            "page_ids": ["id1", "id2"],  // 鍙€夛紝瑕佸鍑虹殑椤甸潰ID鍒楄〃锛堜笉鎻愪緵鍒欏鍑烘墍鏈夛級
            "max_depth": 1,      // 鍙€夛紝閫掑綊娣卞害锛堥粯璁?=涓嶉€掑綊锛?=閫掑綊涓€灞傦級
            "max_workers": 8     // 鍙€夛紝骞跺彂鏁帮紙榛樿 8锛?        }
    
    Returns:
        JSON with task_id, e.g.
        {
            "success": true,
            "data": {
                "task_id": "uuid-here",
                "method": "recursive_analysis",
                "max_depth": 2,
                "max_workers": 8
            },
            "message": "Export task created"
        }
    
    杞 /api/projects/{project_id}/tasks/{task_id} 鑾峰彇杩涘害鍜屼笅杞介摼鎺?    """
    try:
        project, resp = get_project_or_response(project_id, required_permission=REQUIRED_PERMISSION_DOWNLOAD)
        if resp is not None:
            return resp
        project = Project.query.get(project_id)
        # Get parameters from request body
        data = request.get_json() or {}
        
        # Get page_ids from request body and fetch filtered pages
        selected_page_ids = parse_page_ids_from_body(data)
        pages = get_filtered_pages(project_id, selected_page_ids if selected_page_ids else None)
        
        if not pages:
            return bad_request("鏆傛棤椤甸潰鍙鍑猴紝璇峰厛娣诲姞鎴栫敓鎴愰〉闈?)

        _fs_check = FileService(current_app.config['UPLOAD_FOLDER'])
        has_images = any(resolve_export_page_image_abs_path(page, _fs_check) for page in pages)
        if not has_images:
            return bad_request("No generated images found for project")

        # Get parameters from request body
        filename = build_project_export_filename(
            project,
            '.pptx',
            explicit=data.get('filename'),
            fallback_id=project_id,
            pages=pages,
        )
        # max_depth 璇箟锛?=鍙鐞嗚〃灞備笉閫掑綊锛?=閫掑綊涓€灞傦紙澶勭悊鍥剧墖/鍥捐〃涓殑瀛愬厓绱狅級
        max_depth = data.get('max_depth', 1)  # 榛樿涓嶉€掑綊锛屼笌娴嬭瘯鑴氭湰涓€鑷?        from utils.ppt_export_config import (
            get_ppt_export_max_workers,
            get_ppt_export_inpaint_enhance_quality,
            resolve_effective_export_extractor_method,
            resolve_effective_export_inpaint_method,
        )
        max_workers = data.get('max_workers', get_ppt_export_max_workers())
        
        # Validate parameters
        # max_depth >= 1: 鑷冲皯澶勭悊琛ㄥ眰鍏冪礌
        if not isinstance(max_depth, int) or max_depth < 1 or max_depth > 5:
            return bad_request("max_depth must be an integer between 1 and 5")
        
        if not isinstance(max_workers, int) or max_workers < 1 or max_workers > 16:
            return bad_request("max_workers must be an integer between 1 and 16")

        # 璺宠繃閫愬厓绱犳枃瀛楁牱寮忥紙VLM/鏍囬妯″瀷鎵瑰鐞嗭級锛氭樉钁楃缉鐭彲缂栬緫瀵煎嚭鎬绘椂闀匡紝鐗堝紡涓庢枃鏈粛鍦紝绮剧粏鏍峰紡鍙兘闄嶇骇
        if "skip_text_styles" in data:
            skip_text_styles = bool(data.get("skip_text_styles"))
        else:
            _pv = getattr(project, "export_skip_text_styles", None)
            # 涓?to_dict 涓€鑷达細搴撳唴 NULL 瑙嗕负榛樿寮€鍚互鎻愰€燂紱鏄惧紡 False 鎵嶈窇绮剧粏鏍峰紡
            skip_text_styles = True if _pv is None else bool(_pv)

        # Create task record
        user_id = getattr(g, 'current_user', None) and getattr(g.current_user, 'id', None)
        if user_id:
            from services.heavy_task_mutex_service import assert_no_blocking_heavy_task

            mutex_resp = assert_no_blocking_heavy_task(str(user_id))
            if mutex_resp is not None:
                return mutex_resp

        task = Task(
            project_id=project_id,
            user_id=user_id,
            task_type='EXPORT_EDITABLE_PPTX',
            status='PENDING'
        )
        db.session.add(task)
        db.session.commit()
        
        logger.info(f"Created export task {task.id} for project {project_id} (recursive analysis: depth={max_depth}, workers={max_workers})")
        
        # task_manager锛團ileService 浠呯敤妯″潡椤堕儴瀵煎叆锛岄伩鍏嶅嚱鏁板唴鍐?import 瀵艰嚧 UnboundLocalError锛?        from services.task_manager import task_manager, export_editable_pptx_with_recursive_analysis_task

        file_service = FileService(current_app.config['UPLOAD_FOLDER'])
        
        # Get Flask app instance for background task
        app = current_app._get_current_object()
        
        # 璇诲彇椤圭洰鐨勫鍑鸿缃?        export_extractor_method = resolve_effective_export_extractor_method(project.export_extractor_method)
        export_inpaint_method = resolve_effective_export_inpaint_method(project.export_inpaint_method)
        logger.info(
            f"Export settings: extractor={export_extractor_method}, inpaint={export_inpaint_method}, "
            f"skip_text_styles={skip_text_styles}, enhance_quality={get_ppt_export_inpaint_enhance_quality()}"
        )

        # 浣跨敤閫掑綊鍒嗘瀽浠诲姟锛堜笉闇€瑕?ai_service锛屼娇鐢?ImageEditabilityService锛?        task_manager.submit_task(
            task.id,
            export_editable_pptx_with_recursive_analysis_task,
            project_id=project_id,
            filename=filename,
            file_service=file_service,
            page_ids=selected_page_ids if selected_page_ids else None,
            max_depth=max_depth,
            max_workers=max_workers,
            skip_text_styles=skip_text_styles,
            export_extractor_method=export_extractor_method,
            export_inpaint_method=export_inpaint_method,
            app=app,
            task_type=task.task_type,
        )
        
        logger.info(f"Submitted recursive export task {task.id} to task manager")
        
        return success_response(
            data={
                "task_id": task.id,
                "method": "recursive_analysis",
                "max_depth": max_depth,
                "max_workers": max_workers,
                "skip_text_styles": skip_text_styles,
                "filename": filename,
            },
            message="Export task created (using recursive analysis)"
        )
    
    except Exception as e:
        logger.exception("Error creating export task")
        return error_response('SERVER_ERROR', str(e), 500)
