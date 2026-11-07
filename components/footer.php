<?php
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'])) {
    http_response_code(403);
    exit('Access denied.');
}
?>
    <footer class="app-footer">
        <div class="container-fluid text-center">
            <span>Binary Alive &bull; High Performance Process Supervisor</span>
        </div>
    </footer>

    <!-- Bootstrap 5 Bundle JS -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <!-- Core Application Client Controller -->
    <script src="assets/js/app.js"></script>
</body>
</html>
