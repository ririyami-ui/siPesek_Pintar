<?php
$req = Request::create("/api/admin/dashboard/monitoring", "GET");
$res = app()->handle($req);
echo $res->getContent();
